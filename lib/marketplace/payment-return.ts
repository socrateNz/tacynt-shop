// Retour dans l'app Sodu après la page de paiement (Codees ou Stripe). Les
// prestataires exigent une URL http(s) de retour : on leur donne notre route
// /api/marketplace/payments/return, qui redirige ensuite vers le lien
// profond de l'app. Seuls les schémas de l'app sont acceptés (jamais une URL
// web arbitraire : pas de redirection ouverte).
const ALLOWED_SCHEMES = ["sodu://", "exp://", "exps://"];

export function isAllowedAppReturn(url: string): boolean {
  return ALLOWED_SCHEMES.some((scheme) => url.startsWith(scheme)) && url.length <= 500;
}

export function buildReturnUrl(origin: string, appReturnUrl: string, orderId: string): string {
  const url = new URL("/api/marketplace/payments/return", origin);
  url.searchParams.set("to", appReturnUrl);
  url.searchParams.set("orderId", orderId);
  return url.toString();
}
