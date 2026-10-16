import { NextResponse } from "next/server";

import { withTenantContext } from "@/lib/db/tenant-context";
import { verifyAndApplyPayment } from "@/lib/payments/service";
import { resolveStorefrontOrganization } from "@/lib/storefront/context";

const TERMINAL_STATUSES = new Set(["REUSSI", "ECHEC", "EXPIRE"]);

// Public (aucune session) : interrogé en polling par la page de suivi après
// le retour de Codees. Une panne Codees ne doit JAMAIS faire planter cette
// route en 500 — verifyAndApplyPayment avale déjà ses propres erreurs
// réseau, mais on l'entoure quand même ici en défense supplémentaire.
export async function GET(request: Request) {
  const host = request.headers.get("host") ?? "";
  const organization = await resolveStorefrontOrganization(host);
  if (!organization) {
    return NextResponse.json({ error: "Boutique introuvable." }, { status: 404 });
  }

  const orderId = new URL(request.url).searchParams.get("orderId") ?? "";
  if (!orderId) {
    return NextResponse.json({ error: "Commande requise." }, { status: 400 });
  }

  const order = await withTenantContext({ organizationId: organization.id }, (tx) =>
    tx.onlineOrder.findUnique({
      where: { id: orderId },
      include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } },
    }),
  );
  if (!order) {
    return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
  }

  let latestPayment = order.payments[0] ?? null;
  let orderStatut = order.statut;
  if (latestPayment && !TERMINAL_STATUSES.has(latestPayment.statut)) {
    try {
      const result = await verifyAndApplyPayment(
        { organizationId: organization.id, shopId: order.shopId },
        latestPayment.id,
      );
      latestPayment = result.payment;
      orderStatut = result.order.statut;
    } catch (error) {
      console.error("Échec de la vérification du paiement :", error);
    }
  }

  return NextResponse.json({
    orderStatut,
    paiement: latestPayment ? { statut: latestPayment.statut, expiresAt: latestPayment.expiresAt } : null,
  });
}
