import { NextResponse, type NextRequest } from "next/server";

import { findSessionByToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import {
  findPlatformSessionByToken,
  PLATFORM_SESSION_COOKIE_NAME,
} from "@/lib/auth/platform-session";
import { extractSlugFromHost, resolveOrganizationBySlug } from "@/lib/tenant/resolve";

// Pages ET routes accessibles sans session valide, une fois le sous-domaine
// résolu. Sans /api/auth/login ici, le POST de connexion serait lui-même
// redirigé vers /login avant d'atteindre le handler — piège repéré en
// traçant le flux avant de brancher les pages.
const PUBLIC_PATHS = new Set([
  "/login",
  "/login/mfa",
  "/signup",
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/logout",
  "/api/auth/mfa/verify",
]);

// Même principe pour l'espace admin plateforme (Phase 3, M25), servi sur le
// domaine racine — voir la branche `!slug` ci-dessous.
const PLATFORM_PUBLIC_PATHS = new Set([
  "/platform/login",
  "/api/platform/auth/login",
  "/api/platform/auth/logout",
]);

// Anti-spoofing : ces headers ne doivent jamais venir du client. proxy.ts
// est la seule source autorisée à les poser (cahier des charges 4.3 :
// "jamais transmis par le client dans le corps de la requête").
const SPOOFABLE_HEADER_PREFIXES = ["x-tenant-", "x-user-", "x-platform-"];

function isPlatformPath(pathname: string): boolean {
  return pathname.startsWith("/platform") || pathname.startsWith("/api/platform");
}

export async function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  for (const key of Array.from(requestHeaders.keys())) {
    if (SPOOFABLE_HEADER_PREFIXES.some((prefix) => key.toLowerCase().startsWith(prefix))) {
      requestHeaders.delete(key);
    }
  }

  const host = request.headers.get("host") ?? "";
  const slug = extractSlugFromHost(host);
  const { pathname } = request.nextUrl;

  // /platform/* n'existe QUE sur le domaine racine (pas de sous-domaine
  // résolu) — sur le sous-domaine d'une boutique, le chemin est introuvable
  // plutôt que de retomber silencieusement sur le flux d'authentification
  // tenant (qui ne sait de toute façon rien faire de x-platform-admin-id).
  if (slug && isPlatformPath(pathname)) {
    return new NextResponse("Introuvable.", { status: 404 });
  }

  if (!slug) {
    if (isPlatformPath(pathname)) {
      if (PLATFORM_PUBLIC_PATHS.has(pathname)) {
        return NextResponse.next({ request: { headers: requestHeaders } });
      }

      const platformToken = request.cookies.get(PLATFORM_SESSION_COOKIE_NAME)?.value;
      const platformSession = platformToken
        ? await findPlatformSessionByToken(platformToken)
        : null;

      if (!platformSession) {
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = "/platform/login";
        return NextResponse.redirect(loginUrl);
      }

      requestHeaders.set("x-platform-admin-id", platformSession.platformAdminId);
      return NextResponse.next({ request: { headers: requestHeaders } });
    }

    // Domaine racine (pas de sous-domaine résolu) : marketing/inscription
    // uniquement, aucun contexte tenant à établir ici.
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const organization = await resolveOrganizationBySlug(slug);
  if (!organization) {
    return new NextResponse("Boutique introuvable.", { status: 404 });
  }

  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await findSessionByToken(token) : null;

  // Rejet explicite du réutilisation de cookie cross-tenant : une session
  // valide pour une autre organisation ne doit jamais s'appliquer ici.
  if (!session || session.organizationId !== organization.id) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  requestHeaders.set("x-tenant-org-id", organization.id);
  requestHeaders.set("x-tenant-org-status", organization.statut);
  requestHeaders.set("x-user-id", session.userId);
  requestHeaders.set("x-user-role", session.user.role);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

// Ne jamais exclure une route /app ou /api du matcher : les Server Actions
// sont des POST vers leur propre route, un matcher trop restrictif
// contournerait silencieusement l'auth dessus (cf. doc Next 16 sur proxy.ts).
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
