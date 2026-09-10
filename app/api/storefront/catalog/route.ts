import { NextResponse } from "next/server";

import { withTenantContext } from "@/lib/db/tenant-context";
import { getStorefrontCatalog } from "@/lib/storefront/catalog";
import { resolveStorefrontOrganization, resolveStorefrontShopId } from "@/lib/storefront/context";

// Public (aucune session) : consommé par le panier/la page de commande côté
// client (M30) pour rafraîchir prix/disponibilité sans recharger la page.
export async function GET(request: Request) {
  const host = request.headers.get("host") ?? "";
  const organization = await resolveStorefrontOrganization(host);
  if (!organization) {
    return NextResponse.json({ error: "Boutique introuvable." }, { status: 404 });
  }

  const url = new URL(request.url);
  const shopId = await resolveStorefrontShopId(organization.id, url.searchParams.get("shop"));
  if (!shopId) {
    return NextResponse.json({ error: "Aucune boutique disponible." }, { status: 404 });
  }

  const items = await withTenantContext({ organizationId: organization.id, shopId }, (tx) =>
    getStorefrontCatalog(tx, shopId),
  );

  return NextResponse.json({ shopId, items });
}
