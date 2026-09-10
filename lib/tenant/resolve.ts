import { systemPrisma } from "@/lib/db/system-client";

const ROOT_DOMAIN = process.env.APP_ROOT_DOMAIN ?? "localhost:3000";
const RESERVED_SUBDOMAINS = new Set(["www", "api"]);

// {slug}.localhost:3000 fonctionne nativement sur Windows/Chrome/Edge/
// Firefox en local, sans édition du fichier hosts (cahier des charges 4.3 :
// résolution du tenant par sous-domaine).
export function extractSlugFromHost(host: string): string | null {
  const normalizedHost = host.toLowerCase();
  if (!normalizedHost.endsWith(ROOT_DOMAIN)) return null;

  const prefix = normalizedHost.slice(0, -ROOT_DOMAIN.length);
  const slug = prefix.replace(/\.$/, "");

  if (!slug || RESERVED_SUBDOMAINS.has(slug)) return null;
  return slug;
}

// Bootstrap : appelé avant qu'un contexte tenant n'existe, donc rôle
// système (comme la session, cf. lib/auth/session.ts).
export async function resolveOrganizationBySlug(slug: string) {
  return systemPrisma.organization.findUnique({ where: { slug } });
}

// White label — domaine personnalisé (Phase 4, M27). Ne matche QUE si le
// domaine a été vérifié (challenge TXT, lib/tenant/settings.ts) : jamais
// résoudre un domaine tant que la preuve de propriété n'est pas faite. La
// disponibilité par plan (ENTERPRISE, lib/tenant/entitlements.ts) est
// vérifiée par l'appelant (proxy.ts) — un plan rétrogradé ne doit pas
// laisser un ancien domaine continuer à fonctionner silencieusement.
export async function resolveOrganizationByCustomDomain(host: string) {
  const normalizedHost = host.toLowerCase().replace(/:\d+$/, "");
  return systemPrisma.organization.findFirst({
    where: { customDomain: normalizedHost, customDomainVerified: true },
  });
}
