import type { PaymentProvider } from "@prisma/client";
import { NextResponse } from "next/server";

import { systemPrisma } from "@/lib/db/system-client";
import { requestOrigin } from "@/lib/http/request-origin";
import { LAUNDRY_PAYMENT_ERRORS, LaundryPaymentError, initiateLaundryPayment } from "@/lib/laundry/payments";
import { getMarketplaceCustomer, unauthorized } from "@/lib/marketplace/auth";
import { resolveMarketplaceOrganization } from "@/lib/marketplace/catalog";
import { buildReturnUrl, isAllowedAppReturn } from "@/lib/marketplace/payment-return";

const PROVIDERS: PaymentProvider[] = ["CODEES", "STRIPE"];

// Paiement en ligne du montant déclaré d'une commande de blanchisserie
// (compte obligatoire, commande du client). Même contrat que
// /api/marketplace/orders/[orderId]/pay : URL de la page hébergée, retour
// dans l'app par appReturnUrl.
export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const customer = await getMarketplaceCustomer(request);
  if (!customer) return unauthorized();

  const { orderId } = await params;
  const body = (await request.json().catch(() => null)) as { provider?: string; appReturnUrl?: string } | null;
  const provider = PROVIDERS.find((p) => p === body?.provider);
  const appReturnUrl = String(body?.appReturnUrl ?? "");
  if (!provider) return NextResponse.json({ error: "Moyen de paiement invalide." }, { status: 400 });
  if (!isAllowedAppReturn(appReturnUrl)) {
    return NextResponse.json({ error: "Adresse de retour invalide." }, { status: 400 });
  }

  const owned = await systemPrisma.laundryOrder.findFirst({
    where: { id: orderId, marketplaceCustomerId: customer.id },
    select: { organizationId: true },
  });
  const organization = owned ? await resolveMarketplaceOrganization(owned.organizationId, "blanchisserie") : null;
  if (!organization) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });

  try {
    const result = await initiateLaundryPayment({
      organization,
      orderId,
      provider,
      returnUrl: buildReturnUrl(requestOrigin(request), appReturnUrl, orderId),
      marketplaceCustomerId: customer.id,
    });
    if (!result.ok) return NextResponse.json({ error: result.detail }, { status: 502 });
    return NextResponse.json({ url: result.url });
  } catch (error) {
    if (error instanceof LaundryPaymentError) {
      const { status, error: message } = LAUNDRY_PAYMENT_ERRORS[error.code];
      return NextResponse.json({ error: message }, { status });
    }
    throw error;
  }
}
