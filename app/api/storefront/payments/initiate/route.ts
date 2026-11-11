import type { PaymentProvider } from "@prisma/client";
import { NextResponse } from "next/server";

import { requestOrigin } from "@/lib/http/request-origin";
import { readMobileMoneyPayer } from "@/lib/payments/payer-input";
import { PAYMENT_INIT_ERRORS, PaymentInitError, initiateOrderPayment } from "@/lib/payments/initiate";
import { resolveStorefrontOrganization } from "@/lib/storefront/context";

const PROVIDERS: PaymentProvider[] = ["CODEES", "STRIPE"];

// Public (aucune session) : démarre une session de paiement en ligne pour
// une commande déjà créée, depuis la vitrine web. `provider` facultatif :
// sans lui, comportement historique (Codees pour une organisation
// camerounaise en XAF, sinon carte) — le client choisit ensuite
// Orange/MTN ou saisit sa carte sur la page du prestataire. Le montant est
// toujours relu depuis la commande en base (lib/payments/initiate.ts).
export async function POST(request: Request) {
  const host = request.headers.get("host") ?? "";
  const organization = await resolveStorefrontOrganization(host);
  if (!organization) {
    return NextResponse.json({ error: "Boutique introuvable." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as {
    orderId?: string;
    provider?: string;
    telephone?: string;
    operateur?: string;
  } | null;
  const orderId = String(body?.orderId ?? "").trim();
  if (!orderId) {
    return NextResponse.json({ error: "Commande requise." }, { status: 400 });
  }
  // Numéro Mobile Money fourni = paiement direct (demande envoyée sur le
  // téléphone, le client reste sur le site) ; sinon page hébergée.
  const { payer, error: payerError } = readMobileMoneyPayer(body);
  if (payerError) return NextResponse.json({ error: payerError }, { status: 400 });
  const requested = PROVIDERS.find((p) => p === body?.provider);
  const provider: PaymentProvider =
    requested ?? (organization.pays === "CM" && organization.devise === "XAF" ? "CODEES" : "STRIPE");

  try {
    const result = await initiateOrderPayment({
      organization,
      orderId,
      provider,
      returnUrl: new URL(`/merci/${orderId}`, requestOrigin(request)).toString(),
      mobileMoney: payer,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.detail }, { status: 502 });
    }
    return NextResponse.json(result.mode === "DIRECT" ? { mode: "DIRECT" } : { mode: "CHECKOUT", url: result.url });
  } catch (error) {
    if (error instanceof PaymentInitError) {
      const { status, error: message } = PAYMENT_INIT_ERRORS[error.code];
      return NextResponse.json({ error: message }, { status });
    }
    throw error;
  }
}
