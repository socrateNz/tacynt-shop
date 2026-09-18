import { headers } from "next/headers";

import { systemPrisma } from "@/lib/db/system-client";
import { organizationCanUseWhiteLabel } from "@/lib/tenant/entitlements";
import { organizationHasModule } from "@/lib/tenant/modules";
import {
  extractSlugFromHost,
  resolveOrganizationByCustomDomain,
  resolveOrganizationBySlug,
} from "@/lib/tenant/resolve";

// Vitrine e-commerce (Phase 4, M29) : résolution anonyme par host, même
// principe que login/page.tsx — jamais getTenantContext() (exige une
// session). Retourne null (jamais ne lève) pour laisser chaque appelant
// répondre avec le mécanisme adapté à son contexte : notFound() pour une
// page, NextResponse 404 pour une route API.
export async function resolveStorefrontOrganization(host: string) {
  const slug = extractSlugFromHost(host);
  let organization = slug
    ? await resolveOrganizationBySlug(slug)
    : await resolveOrganizationByCustomDomain(host);

  if (!slug && organization && !organizationCanUseWhiteLabel(organization.plan)) {
    organization = null;
  }

  if (!organization || !organizationHasModule(organization.enabledModules, "ecommerce")) {
    return null;
  }

  return organization;
}

export async function getStorefrontOrganization() {
  const h = await headers();
  return resolveStorefrontOrganization(h.get("host") ?? "");
}

export type RootPageContext =
  | { kind: "marketing" }
  | { kind: "not-found" }
  | { kind: "storefront"; organization: NonNullable<Awaited<ReturnType<typeof resolveOrganizationBySlug>>> };

// Racine "/" (M32) : contrairement à resolveStorefrontOrganization, qui
// confond "domaine racine marketing" et "hôte tenant mais module ecommerce
// désactivé" dans un même null (les deux appellent notFound() côté
// appelant), app/page.tsx doit distinguer les deux — le premier cas rend
// MarketingHome, le second un vrai 404. proxy.ts a déjà garanti (404
// "Boutique introuvable") qu'une organisation existe pour tout hôte tenant
// qui atteint une page ; ici on ne fait que rejouer la même résolution
// (jamais confiance aux headers proxy sur un chemin anonyme, même principe
// que resolveStorefrontOrganization) pour retrouver ce résultat.
export async function resolveRootPageContext(host: string): Promise<RootPageContext> {
  const slug = extractSlugFromHost(host);
  let organization = slug
    ? await resolveOrganizationBySlug(slug)
    : await resolveOrganizationByCustomDomain(host);

  if (!slug && organization && !organizationCanUseWhiteLabel(organization.plan)) {
    organization = null;
  }

  const isTenantHost = slug !== null || organization !== null;
  if (!isTenantHost) {
    return { kind: "marketing" };
  }

  if (!organization || !organizationHasModule(organization.enabledModules, "ecommerce")) {
    return { kind: "not-found" };
  }

  return { kind: "storefront", organization };
}

export async function getRootPageContext(): Promise<RootPageContext> {
  const h = await headers();
  return resolveRootPageContext(h.get("host") ?? "");
}

// Sélection de boutique pour la vitrine (pas de session, donc pas de
// user_shops à consulter comme lib/tenant/active-shop.ts) : la boutique
// demandée par ?shop=, sinon la première boutique active de l'organisation.
export async function resolveStorefrontShopId(
  organizationId: string,
  requestedShopId?: string | null,
) {
  const shops = await systemPrisma.shop.findMany({
    where: { organizationId, actif: true },
    orderBy: { nom: "asc" },
  });

  if (shops.length === 0) return null;
  if (requestedShopId && shops.some((s) => s.id === requestedShopId)) {
    return requestedShopId;
  }
  return shops[0].id;
}
