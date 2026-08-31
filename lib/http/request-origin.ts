// request.url ne reflète pas toujours fidèlement le header Host reçu (vu en
// pratique : un POST sur boutique-a.localhost:3000/api/auth/login produisait
// un `Location: http://localhost:3000/`, perdant le sous-domaine). Le header
// Host, lui, est fiable — c'est déjà lui qui sert à résoudre le tenant dans
// proxy.ts et lib/tenant/resolve.ts.
export function requestOrigin(request: Request): string {
  const host = request.headers.get("host") ?? "";
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}
