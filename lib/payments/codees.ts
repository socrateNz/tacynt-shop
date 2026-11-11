// Client Codees (Mobile Money, Orange Money/MTN MoMo — Cameroun), Hosted
// Checkout uniquement. Pas de bac à sable : ces clés sont celles de
// production, chaque appel est un vrai appel. Contrat tiré du schéma OpenAPI
// brut (https://pay.codees-cm.com/merchant/api-reference/?format=openapi)
// et de la doc (https://pay.codees-cm.com/docs/) : /checkout/create/,
// /checkout/{id}/status/, et /payment/status/ en lecture seule pour la
// raison d'un échec. Jamais /payment/process/ (paiement hors page hébergée).
import { createHmac, timingSafeEqual } from "node:crypto";

const CODEES_BASE_URL = "https://pay.codees-cm.com/api/v1";

// Documenté : une session Codees expire au bout de 30 minutes.
export const PAIEMENT_EXPIRATION_MS = 30 * 60 * 1000;

const CODEES_TIMEOUT_MS = 10_000;

// Les erreurs Codees arrivent sous la forme {"detail": "..."} — ce `detail`
// est toujours plus utile que le seul code HTTP (ex. 403 "Invalid API
// credentials") et doit être remonté tel quel à l'appelant.
export class CodeesError extends Error {
  readonly status: number;

  constructor(detail: string, status: number) {
    super(detail);
    this.name = "CodeesError";
    this.status = status;
  }
}

function getCodeesHeaders(): Record<string, string> {
  const apiKey = process.env.CODEES_API_KEY;
  const secretKey = process.env.CODEES_SECRET_KEY;
  if (!apiKey || !secretKey) {
    throw new Error("CODEES_API_KEY / CODEES_SECRET_KEY manquants — configuration incomplète.");
  }
  return {
    "X-API-Key": apiKey,
    "X-Secret-Key": secretKey,
    "Content-Type": "application/json",
  };
}

export type CreateCheckoutInput = {
  amount: string;
  currency: "XAF";
  reference: string;
  customer_name: string;
  customer_email: string;
  success_url: string;
  cancel_url: string;
};

export type CreateCheckoutResult = {
  checkout_id: string;
  checkout_url: string;
  expires_at: string;
};

export type CodeesCheckoutStatus =
  | "open"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired";

export type CheckoutStatusResult = {
  status: CodeesCheckoutStatus;
  amount: string;
  currency: string;
};

async function readDetail(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { detail?: string } | null;
  return body?.detail || res.statusText || `Erreur Codees (${res.status})`;
}

async function codeesFetch(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(`${CODEES_BASE_URL}${path}`, {
      ...init,
      headers: getCodeesHeaders(),
      signal: AbortSignal.timeout(CODEES_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof CodeesError) throw error;
    const message = error instanceof Error ? error.message : "Erreur réseau inconnue.";
    throw new CodeesError(`Impossible de contacter Codees : ${message}`, 0);
  }
}

export async function createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
  const res = await codeesFetch("/checkout/create/", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new CodeesError(await readDetail(res), res.status);
  }
  return res.json() as Promise<CreateCheckoutResult>;
}

export async function getCheckoutStatus(checkoutId: string): Promise<CheckoutStatusResult> {
  const res = await codeesFetch(`/checkout/${encodeURIComponent(checkoutId)}/status/`, {
    method: "GET",
  });
  if (!res.ok) {
    throw new CodeesError(await readDetail(res), res.status);
  }
  return res.json() as Promise<CheckoutStatusResult>;
}

export type PaymentStatusResult = {
  status: string;
  failure_code?: string | null;
  failure_message?: string | null;
};

// Détail d'une transaction Mobile Money (documenté dans /docs/, pas dans le
// schéma OpenAPI) : seule source de la RAISON d'un échec (failure_code :
// INSUFFICIENT_FUNDS, CUSTOMER_DECLINED…) — le statut de session checkout
// ne la donne pas. Par référence, Codees renvoie la transaction la plus
// récente portant cette référence. Réponse mise en cache 30 s chez Codees.
export async function getPaymentStatus(
  query: { transactionId: string } | { reference: string },
): Promise<PaymentStatusResult> {
  const qs =
    "transactionId" in query
      ? `transaction_id=${encodeURIComponent(query.transactionId)}`
      : `reference=${encodeURIComponent(query.reference)}`;
  const res = await codeesFetch(`/payment/status/?${qs}`, { method: "GET" });
  if (!res.ok) {
    throw new CodeesError(await readDetail(res), res.status);
  }
  return res.json() as Promise<PaymentStatusResult>;
}

// Signature du webhook : HMAC-SHA256 (hex) du corps BRUT avec le secret de
// signature du tableau de bord Codees, dans l'en-tête X-Codees-Signature.
// Sans CODEES_WEBHOOK_SECRET configuré, la vérification est sautée (le
// statut est de toute façon toujours relu chez Codees avant d'être appliqué).
export function verifyCodeesSignature(rawBody: string, signature: string | null): "ok" | "invalide" | "non_configure" {
  const secret = process.env.CODEES_WEBHOOK_SECRET;
  if (!secret) return "non_configure";
  if (!signature) return "invalide";
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature.trim().toLowerCase(), "utf8");
  return a.length === b.length && timingSafeEqual(a, b) ? "ok" : "invalide";
}
