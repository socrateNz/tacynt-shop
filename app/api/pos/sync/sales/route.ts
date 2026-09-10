import { NextResponse } from "next/server";

import { systemPrisma } from "@/lib/db/system-client";
import { withTenantContext } from "@/lib/db/tenant-context";
import type { TenantContext } from "@/lib/tenant/context";
import { assertCapability } from "@/lib/permissions";
import { applySale } from "@/lib/sales/apply-sale";
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
// Le cœur du calcul (lignes, stock, paiements, fidélité) vit dans
// lib/sales/apply-sale.ts (Phase 4, M31) — ce wrapper ne fait plus que
// traduire le protocole de synchro POS (idempotence sur uuidClient, forme
// de la réponse) vers/depuis ce helper partagé avec le fulfillment
// e-commerce.
async function processOneSale(
  ctx: TenantContext,
  discountCeiling: number,
  loyaltyPointsPerAmount: number,
  input: SaleInput,
): Promise<SaleResult> {
  try {
    return await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
      const { stockAlert } = await applySale(tx, {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        role: ctx.role,
        sessionId: input.sessionId,
        numero: input.numero,
        uuidClient: input.uuid,
        customerId: input.customerId,
        lines: input.lines,
        payments: input.payments,
        createdAt: new Date(input.clientCreatedAt),
        discountCeiling,
        loyaltyPointsPerAmount,
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
