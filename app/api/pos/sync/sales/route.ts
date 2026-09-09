import { NextResponse } from "next/server";

import { recordAuditLog } from "@/lib/audit";
import { getCustomerBalance, recordCustomerLedgerEntry } from "@/lib/customers/ledger";
import { systemPrisma } from "@/lib/db/system-client";
import { consumeLotsFefo } from "@/lib/stock/lots";
import { assignSerialNumbersFifo } from "@/lib/stock/serial-numbers";
import { recordLoyaltyEntry } from "@/lib/loyalty/ledger";
import type { CustomerLedgerType } from "@prisma/client";
import { withTenantContext } from "@/lib/db/tenant-context";
import type { TenantContext } from "@/lib/tenant/context";
import { assertCapability, canApplyDiscount } from "@/lib/permissions";
import { getTenantContext } from "@/lib/tenant/context";
import { parseOrgSettings } from "@/lib/tenant/settings";

type SaleLineInput = {
  variantId: string;
  quantite: number;
  prixUnitaire: number;
  remise?: number;
};

type PaymentInput = {
  mode: "ESPECES" | "MOBILE_MONEY" | "CARTE" | "VIREMENT" | "ARDOISE" | "BON_ACHAT";
  montant: number;
  reference?: string;
};

type SaleInput = {
  uuid: string;
  numero: string;
  sessionId: string;
  customerId?: string | null;
  lines: SaleLineInput[];
  payments: PaymentInput[];
  clientCreatedAt: string;
};

type SaleResult =
  | { uuid: string; status: "applied"; stockAlert: boolean }
  | { uuid: string; status: "duplicate" }
  | { uuid: string; status: "error"; message: string };

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

// Vente hors ligne : UUID généré côté client + numéro issu d'une plage
// pré-allouée (cf. ticket-range/route.ts). Idempotent sur uuidClient — un
// doublon renvoyé par une resynchronisation en double n'est jamais réappliqué.
async function processOneSale(
  ctx: TenantContext,
  discountCeiling: number,
  loyaltyPointsPerAmount: number,
  input: SaleInput,
): Promise<SaleResult> {
  try {
    return await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
      // La session de caisse (poste physique) détermine la boutique de cette
      // vente — jamais la boutique "active" de l'appelant (Phase 3 M18/M20) :
      // un vendeur peut avoir consulté un rapport d'une autre boutique juste
      // avant sans que ça n'affecte où sa vente doit réellement s'imputer.
      const session = await tx.cashSession.findUniqueOrThrow({ where: { id: input.sessionId } });
      const shopId = session.shopId;

      // Pré-calcul : coût figé (CUMP courant) et taxe par ligne, AVANT de
      // créer la vente, pour connaître les totaux corrects dès l'insertion.
      const lineComputations: {
        input: SaleLineInput;
        coutUnitaireFige: number;
        ligneHt: number;
        ligneTaxe: number;
        suiviStock: boolean;
        suiviLots: boolean;
        suiviSerie: boolean;
      }[] = [];

      for (const line of input.lines) {
        const [stockLevel, variant] = await Promise.all([
          tx.stockLevel.findUnique({
            where: { variantId_shopId: { variantId: line.variantId, shopId } },
          }),
          tx.productVariant.findUniqueOrThrow({
            where: { id: line.variantId },
            include: { product: true },
          }),
        ]);

        // Service (suivi_stock = faux, section 5.1) : ni coût figé
        // significatif, ni mouvement de stock à générer.
        const coutUnitaireFige =
          variant.product.suiviStock && stockLevel ? Number(stockLevel.cump) : 0;
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
      const clientCreatedAt = new Date(input.clientCreatedAt);

      // Doublon détecté ici : contrainte unique sur uuid_client. Le catch
      // plus bas transforme l'erreur en statut "duplicate", sans toucher au
      // reste du lot (chaque vente a sa propre transaction).
      const sale = await tx.sale.create({
        data: {
          organizationId: ctx.organizationId,
          shopId,
          numero: input.numero,
          uuidClient: input.uuid,
          sessionId: input.sessionId,
          customerId: input.customerId ?? null,
          totalHt,
          totalTaxe,
          totalTtc,
          userId: ctx.userId,
          createdAt: clientCreatedAt,
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
            organizationId: ctx.organizationId,
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
        // saisie — jamais fait confiance seul (la vente est déjà encaissée
        // à ce stade, on ne l'annule pas : on la journalise comme
        // "exceptionnelle" pour revue managériale, section 5.8).
        if (
          (line.remise ?? 0) > 0 &&
          !canApplyDiscount(ctx.role, line.remise ?? 0, discountCeiling)
        ) {
          await recordAuditLog(tx, {
            organizationId: ctx.organizationId,
            userId: ctx.userId,
            action: "EXCEPTIONAL_DISCOUNT",
            entite: "sale",
            entiteId: sale.id,
            apres: { variantId: line.variantId, remise: line.remise, discountCeiling },
          });
        }

        if (!suiviStock) continue;

        let nouvelleQuantite: number;

        if (suiviLots) {
          // FEFO (section 5.1, Phase 3 M22) : peut générer plusieurs
          // mouvements pour cette seule ligne si elle chevauche deux lots.
          const result = await consumeLotsFefo(tx, {
            organizationId: ctx.organizationId,
            shopId,
            variantId: line.variantId,
            quantite: Math.abs(line.quantite),
            type: "VENTE",
            documentType: "sale",
            documentId: sale.id,
            userId: ctx.userId,
            createdAt: clientCreatedAt,
          });
          nouvelleQuantite = result.nouvelleQuantite;

          if (result.expiredLotConsumed) {
            await recordAuditLog(tx, {
              organizationId: ctx.organizationId,
              userId: ctx.userId,
              action: "EXPIRED_LOT_CONSUMED",
              entite: "sale",
              entiteId: sale.id,
              apres: { variantId: line.variantId },
            });
          }
        } else {
          await tx.stockMovement.create({
            data: {
              organizationId: ctx.organizationId,
              shopId,
              variantId: line.variantId,
              type: "VENTE",
              quantite: -Math.abs(line.quantite), // sortie : signe négatif
              coutUnitaire: coutUnitaireFige,
              documentType: "sale",
              documentId: sale.id,
              userId: ctx.userId,
              createdAt: clientCreatedAt,
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
              organizationId: ctx.organizationId,
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
          // ci-dessus, purement une affectation de traçabilité unité par
          // unité — jamais bloquant si moins d'unités connues que vendues.
          const result = await assignSerialNumbersFifo(tx, {
            organizationId: ctx.organizationId,
            shopId,
            variantId: line.variantId,
            quantite: Math.abs(line.quantite),
            saleLineId: saleLine.id,
            soldAt: clientCreatedAt,
          });

          if (result.shortfall > 0) {
            await recordAuditLog(tx, {
              organizationId: ctx.organizationId,
              userId: ctx.userId,
              action: "SERIAL_NUMBER_SHORTFALL",
              entite: "sale",
              entiteId: sale.id,
              apres: { variantId: line.variantId, shortfall: result.shortfall },
            });
          }
        }

        // Cas "stock négatif après resynchronisation" (7.3) : la vente déjà
        // encaissée n'est jamais annulée — on lève une alerte à traiter à
        // l'inventaire, jamais un rejet rétroactif.
        if (nouvelleQuantite < 0) {
          stockAlert = true;
          await tx.stockAlert.create({
            data: {
              organizationId: ctx.organizationId,
              shopId,
              variantId: line.variantId,
              ecart: nouvelleQuantite,
            },
          });
          await recordAuditLog(tx, {
            organizationId: ctx.organizationId,
            userId: ctx.userId,
            action: "STOCK_NEGATIVE_AFTER_SYNC",
            entite: "sale",
            entiteId: sale.id,
            apres: { variantId: line.variantId, nouvelleQuantite },
          });
        }
      }

      for (const payment of input.payments) {
        await tx.payment.create({
          data: {
            organizationId: ctx.organizationId,
            shopId,
            saleId: sale.id,
            mode: payment.mode,
            montant: payment.montant,
            reference: payment.reference ?? null,
          },
        });

        // Vente à crédit (ardoise, M13) ou paiement par bon d'achat (fidélité,
        // M21) : mécaniquement identiques sur customer_ledger (montant positif
        // = le compte du client augmente, qu'il s'agisse d'une nouvelle dette
        // ou de la consommation d'un crédit déjà accordé) — jamais rejetées
        // après coup, même au-delà du plafond, même principe que la remise
        // exceptionnelle ci-dessus.
        if ((payment.mode === "ARDOISE" || payment.mode === "BON_ACHAT") && payment.montant > 0) {
          const ledgerType: CustomerLedgerType =
            payment.mode === "ARDOISE" ? "VENTE_ARDOISE" : "UTILISATION_BON_ACHAT";

          if (!input.customerId) {
            await recordAuditLog(tx, {
              organizationId: ctx.organizationId,
              userId: ctx.userId,
              action: payment.mode === "ARDOISE" ? "ARDOISE_WITHOUT_CUSTOMER" : "BON_ACHAT_WITHOUT_CUSTOMER",
              entite: "sale",
              entiteId: sale.id,
              apres: { montant: payment.montant },
            });
            continue;
          }

          await recordCustomerLedgerEntry(tx, {
            organizationId: ctx.organizationId,
            customerId: input.customerId,
            type: ledgerType,
            montant: payment.montant,
            documentType: "sale",
            documentId: sale.id,
            userId: ctx.userId,
          });

          const [customer, soldeApres] = await Promise.all([
            tx.customer.findUnique({ where: { id: input.customerId } }),
            getCustomerBalance(tx, input.customerId),
          ]);

          // Pour un bon d'achat, dépasser le plafond (souvent 0) signale
          // simplement que le client a utilisé plus de crédit fidélité qu'il
          // n'en avait — même mécanisme d'alerte que le dépassement d'ardoise.
          if (customer && soldeApres > Number(customer.plafondCredit)) {
            await recordAuditLog(tx, {
              organizationId: ctx.organizationId,
              userId: ctx.userId,
              action: "CREDIT_LIMIT_EXCEEDED",
              entite: "customer",
              entiteId: input.customerId,
              apres: {
                saleId: sale.id,
                solde: soldeApres,
                plafondCredit: Number(customer.plafondCredit),
              },
            });
          }
        }
      }

      // Fidélité (section 5.4, M21) : accumulation de points sur le total TTC
      // si un client est rattaché à la vente et que le programme est activé.
      if (input.customerId && loyaltyPointsPerAmount > 0) {
        const points = Math.floor(totalTtc / loyaltyPointsPerAmount);
        if (points > 0) {
          await recordLoyaltyEntry(tx, {
            organizationId: ctx.organizationId,
            customerId: input.customerId,
            type: "GAGNE",
            points,
            documentType: "sale",
            documentId: sale.id,
          });
        }
      }

      await recordAuditLog(tx, {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: "SALE_SYNCED",
        entite: "sale",
        entiteId: sale.id,
        apres: { numero: input.numero, totalTtc },
      });

      return { uuid: input.uuid, status: "applied", stockAlert };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { uuid: input.uuid, status: "duplicate" };
    }
    console.error("Échec de synchronisation de la vente", input.uuid, error);
    return { uuid: input.uuid, status: "error", message: "Erreur serveur." };
  }
}

export async function POST(request: Request) {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "pos:sell");

  const body = (await request.json()) as { sales?: SaleInput[] };
  const sales = body.sales ?? [];

  if (sales.length === 0) {
    return NextResponse.json({ results: [] satisfies SaleResult[] });
  }

  const organization = await systemPrisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
  });
  const orgSettings = parseOrgSettings(organization.settings);
  const discountCeiling = orgSettings.vendeurDiscountCeiling ?? 0;
  const loyaltyPointsPerAmount = orgSettings.loyaltyPointsPerAmount ?? 0;

  const results: SaleResult[] = [];
  // Séquentiel plutôt qu'en parallèle : à l'échelle d'un lot de caisse
  // (quelques ventes), la prévisibilité prime sur la vitesse.
  for (const sale of sales) {
    results.push(await processOneSale(ctx, discountCeiling, loyaltyPointsPerAmount, sale));
  }

  return NextResponse.json({ results });
}
