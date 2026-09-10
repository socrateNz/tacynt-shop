import { notFound } from "next/navigation";

import { withTenantContext } from "@/lib/db/tenant-context";
import { getStorefrontCatalog } from "@/lib/storefront/catalog";
import { getStorefrontOrganization, resolveStorefrontShopId } from "@/lib/storefront/context";

import { ProductCard } from "./product-card";

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

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Catalogue</h1>
        <p className="text-sm text-muted-foreground">
          {items.length} article{items.length > 1 ? "s" : ""} disponible
          {items.length > 1 ? "s" : ""} — paiement à la réception (espèces, Mobile Money, carte).
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {items.map((item) => (
          <ProductCard key={item.variantId} item={item} shopId={shopId} devise={organization.devise} />
        ))}
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucun article disponible pour l&apos;instant.</p>
        )}
      </div>
    </div>
  );
}
