import { notFound } from "next/navigation";

import { withTenantContext } from "@/lib/db/tenant-context";
import { getStorefrontCatalog } from "@/lib/storefront/catalog";
import { getStorefrontOrganization, resolveStorefrontShopId } from "@/lib/storefront/context";

import { CatalogueClient } from "./catalogue-client";

export default async function BoutiquePage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string }>;
}) {
  const organization = await getStorefrontOrganization();
  if (!organization) {
    notFound();
  }

  const { shop: requestedShopId } = await searchParams;
  const shopId = await resolveStorefrontShopId(organization.id, requestedShopId);
  if (!shopId) {
    notFound();
  }

  const items = await withTenantContext({ organizationId: organization.id, shopId }, (tx) =>
    getStorefrontCatalog(tx, shopId),
  );

  const allCategories = Array.from(
    new Set(items.map((item) => item.categoryName).filter((nom): nom is string => nom !== null)),
  ).sort((a, b) => a.localeCompare(b));

  const priceCeiling = items.reduce((max, item) => Math.max(max, item.prixVente), 0) || 1;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Catalogue</h1>
        <p className="text-sm text-muted-foreground">
          {items.length} article{items.length > 1 ? "s" : ""} disponible
          {items.length > 1 ? "s" : ""} — paiement à la réception (espèces, Mobile Money, carte).
        </p>
      </header>

      <CatalogueClient
        items={items}
        shopId={shopId}
        devise={organization.devise}
        allCategories={allCategories}
        priceCeiling={priceCeiling}
      />
    </div>
  );
}
