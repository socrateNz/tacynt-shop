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
