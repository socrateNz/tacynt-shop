import { NextResponse } from "next/server";

import { systemPrisma } from "@/lib/db/system-client";
import { verifyLaundryPayment } from "@/lib/laundry/payments";
import { getMarketplaceCustomer, unauthorized } from "@/lib/marketplace/auth";

// Statut du dernier paiement d'une commande de blanchisserie, revérifié
// chez le prestataire (idempotent) — appelé par l'app au retour de la page
// de paiement, sans attendre le webhook.
export async function GET(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const customer = await getMarketplaceCustomer(request);
  if (!customer) return unauthorized();

  const { orderId } = await params;
  const order = await systemPrisma.laundryOrder.findFirst({
    where: { id: orderId, marketplaceCustomerId: customer.id },
    select: {
      statut: true,
      payments: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, organizationId: true, shopId: true, fournisseur: true },
      },
    },
  });
  if (!order) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });

  const last = order.payments[0];
  if (!last) return NextResponse.json({ orderStatut: order.statut, paymentStatut: null, fournisseur: null });

  const { payment, order: updated } = await verifyLaundryPayment(
    { organizationId: last.organizationId, shopId: last.shopId },
    last.id,
  );
  return NextResponse.json({ orderStatut: updated.statut, paymentStatut: payment.statut, fournisseur: last.fournisseur });
}
