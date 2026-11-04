import Stripe from "stripe";

// Client Stripe (paiement par carte), Checkout hébergé uniquement — même
// principe que Codees (lib/payments/codees.ts) : un seul compte marchand
// plateforme (décision verrouillée), aucune donnée de carte ne transite par
// nos serveurs ni par l'app mobile. Instancié paresseusement : l'absence de
// clé ne doit pas faire planter le build ni les routes qui n'utilisent pas
// Stripe.
let client: Stripe | null = null;

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY manquant — configuration incomplète.");
  if (!client) client = new Stripe(key);
  return client;
}

export class StripePaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripePaymentError";
  }
}

// Devises "zero-decimal" chez Stripe (montant envoyé tel quel, pas en
// centimes) — liste officielle Stripe, inclut le XAF/XOF.
const ZERO_DECIMAL = new Set([
  "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF",
  "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
]);

export function toStripeAmount(amount: number, devise: string): number {
  return ZERO_DECIMAL.has(devise.toUpperCase()) ? Math.round(amount) : Math.round(amount * 100);
}

// Stripe impose au moins 30 minutes avant expiration d'une session.
export const STRIPE_SESSION_TTL_MS = 30 * 60 * 1000;

export async function createStripeCheckout(input: {
  amount: number;
  devise: string;
  description: string;
  reference: string;
  customerEmail: string | null;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
}): Promise<{ id: string; url: string }> {
  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: input.devise.toLowerCase(),
            unit_amount: toStripeAmount(input.amount, input.devise),
            product_data: { name: input.description },
          },
        },
      ],
      client_reference_id: input.reference,
      customer_email: input.customerEmail ?? undefined,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      expires_at: Math.floor((Date.now() + STRIPE_SESSION_TTL_MS) / 1000) + 60,
      metadata: input.metadata,
      payment_intent_data: { metadata: input.metadata },
    });
    if (!session.url) throw new StripePaymentError("Stripe n'a pas renvoyé d'URL de paiement.");
    return { id: session.id, url: session.url };
  } catch (error) {
    if (error instanceof StripePaymentError) throw error;
    const message = error instanceof Error ? error.message : "Erreur Stripe inconnue.";
    throw new StripePaymentError(message);
  }
}

export type StripeSessionState = "paid" | "open" | "expired" | "unpaid_complete";

export async function getStripeCheckoutState(sessionId: string): Promise<{ state: StripeSessionState; raw: unknown }> {
  const session = await getStripe().checkout.sessions.retrieve(sessionId);
  let state: StripeSessionState;
  if (session.payment_status === "paid" || session.payment_status === "no_payment_required") state = "paid";
  else if (session.status === "expired") state = "expired";
  else if (session.status === "complete") state = "unpaid_complete";
  else state = "open";
  return {
    state,
    raw: { id: session.id, status: session.status, payment_status: session.payment_status },
  };
}

// Vérifie la signature du webhook (corps BRUT obligatoire) — contrairement à
// Codees, Stripe signe ses webhooks : tout événement non signé est rejeté.
export function constructStripeEvent(rawBody: string, signature: string | null): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET manquant — configuration incomplète.");
  if (!signature) throw new StripePaymentError("Signature Stripe absente.");
  return getStripe().webhooks.constructEvent(rawBody, signature, secret);
}
