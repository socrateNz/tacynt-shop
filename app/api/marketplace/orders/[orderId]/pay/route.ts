import type { PaymentProvider } from "@prisma/client";
import { NextResponse } from "next/server";

import { systemPrisma } from "@/lib/db/system-client";
import { requestOrigin } from "@/lib/http/request-origin";
import { getMarketplaceCustomer, unauthorized } from "@/lib/marketplace/auth";
import { resolveMarketplaceOrganization } from "@/lib/marketplace/catalog";
import { buildReturnUrl, isAllowedAppReturn } from "@/lib/marketplace/payment-return";
import { PAYMENT_INIT_ERRORS, PaymentInitError, initiateOrderPayment } from "@/lib/payments/initiate";

const PROVIDERS: PaymentProvider[] = ["CODEES", "STRIPE"];

// Démarre le paiement en ligne d'une commande Sodu (compte obligatoire, la
// commande doit appartenir au client). Renvoie l'URL de la page de paiement
// hébergée, que l'app ouvre dans un navigateur intégré ; le retour se fait
// par appReturnUrl (lien profond de l'app). Moyen revalidé contre les
// options réelles de la boutique (pays, activation) dans initiateOrderPayment.
export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const customer = await getMarketplaceCustomer(request);
  if (!customer) return unauthorized();

  const { orderId } = await params;
  const body = (await request.json().catch(() => null)) as { provider?: string; appReturnUrl?: string } | null;
  const provider = PROVIDERS.find((p) => p === body?.provider);
  const appReturnUrl = String(body?.appReturnUrl ?? "");
  if (!provider) {
    return NextResponse.json({ error: "Moyen de paiement invalide." }, { status: 400 });
  }
  if (!isAllowedAppReturn(appReturnUrl)) {
    return NextResponse.json({ error: "Adresse de retour invalide." }, { status: 400 });
  }

  // Lecture minimale cross-organisation pour retrouver l'organisation de la
  // commande, toujours filtrée sur le compte authentifié.
  const owned = await systemPrisma.onlineOrder.findFirst({
    where: { id: orderId, marketplaceCustomerId: customer.id },
    select: { organizationId: true },
  });
  const organization = owned ? await resolveMarketplaceOrganization(owned.organizationId, "ecommerce") : null;
  if (!organization) {
    return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
  }

  try {
    const result = await initiateOrderPayment({
      organization,
      orderId,
      provider,
      returnUrl: buildReturnUrl(requestOrigin(request), appReturnUrl, orderId),
      marketplaceCustomerId: customer.id,
    });
    if (!result.ok) return NextResponse.json({ error: result.detail }, { status: 502 });
    return NextResponse.json({ url: result.url });
  } catch (error) {
    if (error instanceof PaymentInitError) {
      const { status, error: message } = PAYMENT_INIT_ERRORS[error.code];
      return NextResponse.json({ error: message }, { status });
    }
    throw error;
  }
}
