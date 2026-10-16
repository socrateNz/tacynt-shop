// Client Codees (Mobile Money, Orange Money/MTN MoMo — Cameroun), Hosted
// Checkout uniquement. Pas de bac à sable : ces clés sont celles de
// production, chaque appel est un vrai appel. Contrat tiré du schéma OpenAPI
// brut (https://pay.codees-cm.com/merchant/api-reference/?format=openapi) —
// n'utilise QUE /checkout/create/ et /checkout/{id}/status/, jamais
// /payment/process/ ni /payment/status/ (corps/réponses non documentés).
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
