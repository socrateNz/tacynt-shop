"use server";

import { revalidatePath } from "next/cache";

import { recordAuditLog } from "@/lib/audit";
import { systemPrisma } from "@/lib/db/system-client";
import { withTenantContext } from "@/lib/db/tenant-context";
import { assertCapability } from "@/lib/permissions";
import { getTenantContext } from "@/lib/tenant/context";
import { organizationHasModule } from "@/lib/tenant/modules";

async function assertEcommerceAllowed(organizationId: string, role: Parameters<typeof assertCapability>[0]) {
  await assertCapability(role, "ecommerce:manage");
  const organization = await systemPrisma.organization.findUniqueOrThrow({ where: { id: organizationId } });
  if (!organizationHasModule(organization.enabledModules, "ecommerce")) {
    throw new Error("Le module E-commerce n'est pas activé pour cette organisation.");
  }
}

// Transitions purement informationnelles (décision #15) : aucun mouvement
// de stock, aucune vente créée tant que la commande n'est pas récupérée/
// encaissée (RECUPEREE, réservé au fulfillment de M31).
export async function confirmOrder(formData: FormData) {
  const ctx = await getTenantContext();
  await assertEcommerceAllowed(ctx.organizationId, ctx.role);

  const orderId = String(formData.get("orderId") ?? "");
  if (!orderId) return;

  await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
    const order = await tx.onlineOrder.findUniqueOrThrow({ where: { id: orderId } });
    if (order.statut !== "EN_ATTENTE") return;

    await tx.onlineOrder.update({
      where: { id: orderId },
      data: { statut: "CONFIRMEE", confirmedAt: new Date() },
    });

    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "ONLINE_ORDER_CONFIRMED",
      entite: "online_order",
      entiteId: orderId,
    });
  });

  revalidatePath(`/online-orders/${orderId}`);
  revalidatePath("/online-orders");
}

// Annulable à tout moment avant RECUPEREE (décision #16) — une fois
// encaissée, seuls les flux de vente/retour classiques s'appliquent.
export async function cancelOrder(formData: FormData) {
  const ctx = await getTenantContext();
  await assertEcommerceAllowed(ctx.organizationId, ctx.role);

  const orderId = String(formData.get("orderId") ?? "");
  if (!orderId) return;

  await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
    const order = await tx.onlineOrder.findUniqueOrThrow({ where: { id: orderId } });
    if (order.statut === "RECUPEREE" || order.statut === "ANNULEE") return;

    await tx.onlineOrder.update({
      where: { id: orderId },
      data: { statut: "ANNULEE", cancelledAt: new Date() },
    });

    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "ONLINE_ORDER_CANCELLED",
      entite: "online_order",
      entiteId: orderId,
    });
  });

  revalidatePath(`/online-orders/${orderId}`);
  revalidatePath("/online-orders");
}
