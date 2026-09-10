"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import type { PaymentMode } from "@prisma/client";

import { recordAuditLog } from "@/lib/audit";
import { systemPrisma } from "@/lib/db/system-client";
import { withTenantContext } from "@/lib/db/tenant-context";
import { assertCapability } from "@/lib/permissions";
import { applySale } from "@/lib/sales/apply-sale";
import { getTenantContext } from "@/lib/tenant/context";
import { organizationHasModule } from "@/lib/tenant/modules";
import { parseOrgSettings } from "@/lib/tenant/settings";

export type FulfillOrderState = { error: string | null };

const PAYMENT_MODES: PaymentMode[] = ["ESPECES", "MOBILE_MONEY", "CARTE", "VIREMENT", "ARDOISE", "BON_ACHAT"];

// Fulfillment (Phase 4, M31) : la commande en ligne devient une vente au
// comptoir comme une autre — même helper partagé que la synchro POS
// (lib/sales/apply-sale.ts), aucun second calcul de stock/CUMP. Exige une
// CashSession réellement ouverte sur la boutique de la commande, jamais une
// session fictive créée automatiquement (décision verrouillée Phase 4).
export async function fulfillOrder(
  _prevState: FulfillOrderState,
  formData: FormData,
): Promise<FulfillOrderState> {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "ecommerce:manage");

  const organization = await systemPrisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
  });
  if (!organizationHasModule(organization.enabledModules, "ecommerce")) {
    return { error: "Le module E-commerce n'est pas activé pour cette organisation." };
  }

  const orderId = String(formData.get("orderId") ?? "");
  const paymentMode = String(formData.get("paymentMode") ?? "");
  const montant = Number(formData.get("montant") ?? NaN);

  if (!orderId || !PAYMENT_MODES.includes(paymentMode as PaymentMode) || !Number.isFinite(montant) || montant <= 0) {
    return { error: "Mode de paiement et montant (positif) sont requis." };
  }

  const orgSettings = parseOrgSettings(organization.settings);

  try {
    await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
      const order = await tx.onlineOrder.findUniqueOrThrow({
        where: { id: orderId },
        include: { lines: true },
      });

      if (order.statut === "RECUPEREE" || order.statut === "ANNULEE") {
        throw new Error("STATUT_INVALIDE");
      }

      // Jamais de session fictive : une session de caisse réellement ouverte
      // sur CETTE boutique doit déjà exister, comme pour toute vente.
      const openSession = await tx.cashSession.findFirst({
        where: { shopId: order.shopId, closedAt: null },
        orderBy: { openedAt: "desc" },
      });
      if (!openSession) {
        throw new Error("AUCUNE_SESSION_OUVERTE");
      }

      // Numéro alloué via le même mécanisme atomique que ticket-range/route.ts
      // (incrément d'un seul numéro ici, pas une plage de 100 : le
      // fulfillment est synchrone, en ligne, pas une allocation à consommer
      // hors ligne comme la caisse).
      const rows = await tx.$queryRaw<{ current_allocated_max: bigint; code: string }[]>`
        UPDATE registers
        SET current_allocated_max = current_allocated_max + 1
        WHERE id = ${openSession.registerId}::uuid
        RETURNING current_allocated_max, code
      `;
      if (rows.length === 0) throw new Error("REGISTER_NOT_FOUND");
      const numero = `${rows[0].code}-${String(rows[0].current_allocated_max).padStart(6, "0")}`;

      const { sale } = await applySale(tx, {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        role: ctx.role,
        sessionId: openSession.id,
        numero,
        uuidClient: randomUUID(),
        customerId: order.customerId,
        lines: order.lines.map((l) => ({
          variantId: l.variantId,
          quantite: Number(l.quantite),
          prixUnitaire: Number(l.prixUnitaire),
          remise: Number(l.remise),
        })),
        payments: [{ mode: paymentMode as PaymentMode, montant }],
        createdAt: new Date(),
        discountCeiling: orgSettings.vendeurDiscountCeiling ?? 0,
        loyaltyPointsPerAmount: orgSettings.loyaltyPointsPerAmount ?? 0,
      });

      await tx.onlineOrder.update({
        where: { id: orderId },
        data: { statut: "RECUPEREE", saleId: sale.id },
      });

      await recordAuditLog(tx, {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: "ONLINE_ORDER_FULFILLED",
        entite: "online_order",
        entiteId: orderId,
        apres: { saleId: sale.id, saleNumero: sale.numero },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "AUCUNE_SESSION_OUVERTE") {
      return { error: "Ouvrez une session de caisse sur cette boutique avant d'encaisser." };
    }
    if (error instanceof Error && error.message === "STATUT_INVALIDE") {
      return { error: "Cette commande ne peut plus être encaissée." };
    }
    throw error;
  }

  revalidatePath(`/online-orders/${orderId}`);
  revalidatePath("/online-orders");
  return { error: null };
}
