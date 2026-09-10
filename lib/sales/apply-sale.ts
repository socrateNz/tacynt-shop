import type { CustomerLedgerType, Prisma } from "@prisma/client";

import { recordAuditLog } from "@/lib/audit";
import { getCustomerBalance, recordCustomerLedgerEntry } from "@/lib/customers/ledger";
import { recordLoyaltyEntry } from "@/lib/loyalty/ledger";
import { canApplyDiscount, type Role } from "@/lib/permissions";
import { consumeLotsFefo } from "@/lib/stock/lots";
import { assignSerialNumbersFifo } from "@/lib/stock/serial-numbers";

export type ApplySaleLineInput = {
  variantId: string;
  quantite: number;
  prixUnitaire: number;
  remise?: number;
};

export type ApplySalePaymentInput = {
  mode: "ESPECES" | "MOBILE_MONEY" | "CARTE" | "VIREMENT" | "ARDOISE" | "BON_ACHAT";
  montant: number;
  reference?: string;
};

export type ApplySaleParams = {
  organizationId: string;
  userId: string;
  role: Role;
  // La session de caisse (poste physique) détermine la boutique de cette
  // vente — jamais une boutique "active" passée séparément (Phase 3
  // M18/M20) : un vendeur peut avoir consulté un rapport d'une autre
  // boutique juste avant sans que ça n'affecte où sa vente doit réellement
  // s'imputer. Vrai aussi pour le fulfillment e-commerce (M31) : la
  // commande en ligne devient une vente au comptoir comme une autre, tenue
  // par une session de caisse réellement ouverte.
  sessionId: string;
  numero: string;
  uuidClient: string;
  customerId?: string | null;
  lines: ApplySaleLineInput[];
  payments: ApplySalePaymentInput[];
  createdAt: Date;
  discountCeiling: number;
  loyaltyPointsPerAmount: number;
};

export type ApplySaleResult = {
  sale: { id: string; numero: string };
  stockAlert: boolean;
};

// Cœur transactionnel du calcul/enregistrement d'une vente — extrait de
// processOneSale (app/api/pos/sync/sales/route.ts, Phase 1-3) en Phase 4
// M31 pour être réutilisé tel quel par le fulfillment e-commerce
// (app/(admin)/online-orders/[orderId]/actions.ts). Règle non négociable du
// projet : jamais un second calcul de stock/CUMP parallèle. Le comportement
// est identique bit à bit à l'ancien processOneSale pour l'appelant POS —
// seule la responsabilité de résoudre le doublon (uuidClient, P2002) et de
// formater la réponse reste chez l'appelant, propre à chaque protocole.
export async function applySale(
  tx: Prisma.TransactionClient,
  params: ApplySaleParams,
): Promise<ApplySaleResult> {
  const {
    organizationId,
    userId,
    role,
    sessionId,
    numero,
    uuidClient,
    customerId,
    lines,
    payments,
    createdAt,
    discountCeiling,
    loyaltyPointsPerAmount,
  } = params;

  const session = await tx.cashSession.findUniqueOrThrow({ where: { id: sessionId } });
  const shopId = session.shopId;

  // Pré-calcul : coût figé (CUMP courant) et taxe par ligne, AVANT de créer
  // la vente, pour connaître les totaux corrects dès l'insertion.
  const lineComputations: {
    input: ApplySaleLineInput;
    coutUnitaireFige: number;
    ligneHt: number;
    ligneTaxe: number;
    suiviStock: boolean;
    suiviLots: boolean;
    suiviSerie: boolean;
  }[] = [];

  for (const line of lines) {
    const [stockLevel, variant] = await Promise.all([
      tx.stockLevel.findUnique({
        where: { variantId_shopId: { variantId: line.variantId, shopId } },
      }),
      tx.productVariant.findUniqueOrThrow({
        where: { id: line.variantId },
        include: { product: true },
      }),
    ]);

    // Service (suivi_stock = faux, section 5.1) : ni coût figé significatif,
    // ni mouvement de stock à générer.
    const coutUnitaireFige = variant.product.suiviStock && stockLevel ? Number(stockLevel.cump) : 0;
    const remise = line.remise ?? 0;
    const ligneHt = line.prixUnitaire * line.quantite - remise;
    const ligneTaxe = ligneHt * (Number(variant.product.tauxTaxe) / 100);

    lineComputations.push({
      input: line,
      coutUnitaireFige,
      ligneHt,
      ligneTaxe,
      suiviStock: variant.product.suiviStock,
      suiviLots: variant.product.suiviLots,
      suiviSerie: variant.product.suiviSerie,
    });
  }

  const totalHt = lineComputations.reduce((sum, l) => sum + l.ligneHt, 0);
  const totalTaxe = lineComputations.reduce((sum, l) => sum + l.ligneTaxe, 0);
  const totalTtc = totalHt + totalTaxe;

  // Doublon détecté ici pour l'appelant POS : contrainte unique sur
  // uuid_client. Propagé tel quel (pas de try/catch ici), chaque appelant
  // décide comment interpréter une violation P2002.
  const sale = await tx.sale.create({
    data: {
      organizationId,
      shopId,
      numero,
      uuidClient,
      sessionId,
      customerId: customerId ?? null,
      totalHt,
      totalTaxe,
      totalTtc,
      userId,
      createdAt,
    },
  });

  let stockAlert = false;

  for (const {
    input: line,
    coutUnitaireFige,
    suiviStock,
    suiviLots,
    suiviSerie,
  } of lineComputations) {
    const saleLine = await tx.saleLine.create({
      data: {
        organizationId,
        shopId,
        saleId: sale.id,
        variantId: line.variantId,
        quantite: line.quantite,
        prixUnitaire: line.prixUnitaire,
        remise: line.remise ?? 0,
        coutUnitaireFige,
      },
    });

    // Le plafond de remise n'est vérifié côté client que pour guider la
    // saisie — jamais fait confiance seul (la vente est déjà encaissée à ce
    // stade, on ne l'annule pas : on la journalise comme "exceptionnelle"
    // pour revue managériale, section 5.8).
    if ((line.remise ?? 0) > 0 && !canApplyDiscount(role, line.remise ?? 0, discountCeiling)) {
      await recordAuditLog(tx, {
        organizationId,
        userId,
        action: "EXCEPTIONAL_DISCOUNT",
        entite: "sale",
        entiteId: sale.id,
        apres: { variantId: line.variantId, remise: line.remise, discountCeiling },
      });
    }

    if (!suiviStock) continue;

    let nouvelleQuantite: number;

    if (suiviLots) {
      // FEFO (section 5.1, Phase 3 M22) : peut générer plusieurs mouvements
      // pour cette seule ligne si elle chevauche deux lots.
      const result = await consumeLotsFefo(tx, {
        organizationId,
        shopId,
        variantId: line.variantId,
        quantite: Math.abs(line.quantite),
        type: "VENTE",
        documentType: "sale",
        documentId: sale.id,
        userId,
        createdAt,
      });
      nouvelleQuantite = result.nouvelleQuantite;

      if (result.expiredLotConsumed) {
        await recordAuditLog(tx, {
          organizationId,
          userId,
          action: "EXPIRED_LOT_CONSUMED",
          entite: "sale",
          entiteId: sale.id,
          apres: { variantId: line.variantId },
        });
      }
    } else {
      await tx.stockMovement.create({
        data: {
          organizationId,
          shopId,
          variantId: line.variantId,
          type: "VENTE",
          quantite: -Math.abs(line.quantite), // sortie : signe négatif
          coutUnitaire: coutUnitaireFige,
          documentType: "sale",
          documentId: sale.id,
          userId,
          createdAt,
        },
      });

      const current = await tx.stockLevel.findUnique({
        where: { variantId_shopId: { variantId: line.variantId, shopId } },
      });
      const quantiteActuelle = current ? Number(current.quantite) : 0;
      nouvelleQuantite = quantiteActuelle - Math.abs(line.quantite);

      await tx.stockLevel.upsert({
        where: { variantId_shopId: { variantId: line.variantId, shopId } },
        create: {
          organizationId,
          variantId: line.variantId,
          shopId,
          quantite: nouvelleQuantite,
          cump: coutUnitaireFige,
        },
        update: { quantite: nouvelleQuantite },
      });
    }

    if (suiviSerie) {
      // FIFO (section 6, Phase 3 M23) : indépendant du calcul CUMP/lots
      // ci-dessus, purement une affectation de traçabilité unité par unité
      // — jamais bloquant si moins d'unités connues que vendues.
      const result = await assignSerialNumbersFifo(tx, {
        organizationId,
        shopId,
        variantId: line.variantId,
        quantite: Math.abs(line.quantite),
        saleLineId: saleLine.id,
        soldAt: createdAt,
      });

      if (result.shortfall > 0) {
        await recordAuditLog(tx, {
          organizationId,
          userId,
          action: "SERIAL_NUMBER_SHORTFALL",
          entite: "sale",
          entiteId: sale.id,
          apres: { variantId: line.variantId, shortfall: result.shortfall },
        });
      }
    }

    // Cas "stock négatif après resynchronisation" (7.3) : la vente déjà
    // encaissée n'est jamais annulée — on lève une alerte à traiter à
    // l'inventaire, jamais un rejet rétroactif. Même garantie pour le
    // fulfillment e-commerce : le stock a pu bouger entre la confirmation
    // et l'encaissement, jamais un rejet rétroactif de la vente non plus.
    if (nouvelleQuantite < 0) {
      stockAlert = true;
      await tx.stockAlert.create({
        data: {
          organizationId,
          shopId,
          variantId: line.variantId,
          ecart: nouvelleQuantite,
        },
      });
      await recordAuditLog(tx, {
        organizationId,
        userId,
        action: "STOCK_NEGATIVE_AFTER_SYNC",
        entite: "sale",
        entiteId: sale.id,
        apres: { variantId: line.variantId, nouvelleQuantite },
      });
    }
  }

  for (const payment of payments) {
    await tx.payment.create({
      data: {
        organizationId,
        shopId,
        saleId: sale.id,
        mode: payment.mode,
        montant: payment.montant,
        reference: payment.reference ?? null,
      },
    });

    // Vente à crédit (ardoise, M13) ou paiement par bon d'achat (fidélité,
    // M21) : mécaniquement identiques sur customer_ledger (montant positif =
    // le compte du client augmente, qu'il s'agisse d'une nouvelle dette ou
    // de la consommation d'un crédit déjà accordé) — jamais rejetées après
    // coup, même au-delà du plafond, même principe que la remise
    // exceptionnelle ci-dessus.
    if ((payment.mode === "ARDOISE" || payment.mode === "BON_ACHAT") && payment.montant > 0) {
      const ledgerType: CustomerLedgerType =
        payment.mode === "ARDOISE" ? "VENTE_ARDOISE" : "UTILISATION_BON_ACHAT";

      if (!customerId) {
        await recordAuditLog(tx, {
          organizationId,
          userId,
          action: payment.mode === "ARDOISE" ? "ARDOISE_WITHOUT_CUSTOMER" : "BON_ACHAT_WITHOUT_CUSTOMER",
          entite: "sale",
          entiteId: sale.id,
          apres: { montant: payment.montant },
        });
        continue;
      }

      await recordCustomerLedgerEntry(tx, {
        organizationId,
        customerId,
        type: ledgerType,
        montant: payment.montant,
        documentType: "sale",
        documentId: sale.id,
        userId,
      });

      const [customer, soldeApres] = await Promise.all([
        tx.customer.findUnique({ where: { id: customerId } }),
        getCustomerBalance(tx, customerId),
      ]);

      // Pour un bon d'achat, dépasser le plafond (souvent 0) signale
      // simplement que le client a utilisé plus de crédit fidélité qu'il
      // n'en avait — même mécanisme d'alerte que le dépassement d'ardoise.
      if (customer && soldeApres > Number(customer.plafondCredit)) {
        await recordAuditLog(tx, {
          organizationId,
          userId,
          action: "CREDIT_LIMIT_EXCEEDED",
          entite: "customer",
          entiteId: customerId,
          apres: { saleId: sale.id, solde: soldeApres, plafondCredit: Number(customer.plafondCredit) },
        });
      }
    }
  }

  // Fidélité (section 5.4, M21) : accumulation de points sur le total TTC
  // si un client est rattaché à la vente et que le programme est activé.
  if (customerId && loyaltyPointsPerAmount > 0) {
    const points = Math.floor(totalTtc / loyaltyPointsPerAmount);
    if (points > 0) {
      await recordLoyaltyEntry(tx, {
        organizationId,
        customerId,
        type: "GAGNE",
        points,
        documentType: "sale",
        documentId: sale.id,
      });
    }
  }

  await recordAuditLog(tx, {
    organizationId,
    userId,
    action: "SALE_SYNCED",
    entite: "sale",
    entiteId: sale.id,
    apres: { numero, totalTtc },
  });

  return { sale: { id: sale.id, numero: sale.numero }, stockAlert };
}
