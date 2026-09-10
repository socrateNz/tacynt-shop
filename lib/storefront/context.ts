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
