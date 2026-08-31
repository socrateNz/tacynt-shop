import { NextResponse } from "next/server";

import { recordAuditLog } from "@/lib/audit";
import { systemPrisma } from "@/lib/db/system-client";
import { withTenantContext } from "@/lib/db/tenant-context";
import type { TenantContext } from "@/lib/tenant/context";
import { assertCapability, canApplyDiscount } from "@/lib/permissions";
import { getActiveShopId } from "@/lib/tenant/active-shop";
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
  shopId: string,
  discountCeiling: number,
  input: SaleInput,
): Promise<SaleResult> {
  try {
    return await withTenantContext({ organizationId: ctx.organizationId, shopId }, async (tx) => {
      // Pré-calcul : coût figé (CUMP courant) et taxe par ligne, AVANT de
      // créer la vente, pour connaître les totaux corrects dès l'insertion.
      const lineComputations: {
        input: SaleLineInput;
        coutUnitaireFige: number;
        ligneHt: number;
        ligneTaxe: number;
        suiviStock: boolean;
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

      for (const { input: line, coutUnitaireFige, suiviStock } of lineComputations) {
        await tx.saleLine.create({
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

        const movement = await tx.stockMovement.create({
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
        const nouvelleQuantite = quantiteActuelle - Math.abs(line.quantite);

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
            entite: "stock_movement",
            entiteId: movement.id,
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
  assertCapability(ctx.role, "pos:sell");

  const body = (await request.json()) as { sales?: SaleInput[] };
  const sales = body.sales ?? [];

  if (sales.length === 0) {
    return NextResponse.json({ results: [] satisfies SaleResult[] });
  }

  const shopId = await getActiveShopId(ctx.organizationId, ctx.userId);
  const organization = await systemPrisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
  });
  const discountCeiling = parseOrgSettings(organization.settings).vendeurDiscountCeiling ?? 0;

  const results: SaleResult[] = [];
  // Séquentiel plutôt qu'en parallèle : à l'échelle d'un lot de caisse
  // (quelques ventes), la prévisibilité prime sur la vitesse.
  for (const sale of sales) {
    results.push(await processOneSale(ctx, shopId, discountCeiling, sale));
  }

  return NextResponse.json({ results });
}
