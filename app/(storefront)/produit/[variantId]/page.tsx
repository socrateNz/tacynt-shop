import Link from "next/link";
import { notFound } from "next/navigation";

import { withTenantContext } from "@/lib/db/tenant-context";
import { formatMoney } from "@/lib/money";
import { getStorefrontProductDetail } from "@/lib/storefront/catalog";
import { getStorefrontOrganization, resolveStorefrontShopId } from "@/lib/storefront/context";

import { DetailAddToCart } from "./detail-add-to-cart";
import { ProductGallery } from "./product-gallery";

export default async function ProduitPage({
  params,
  searchParams,
}: {
  params: Promise<{ variantId: string }>;
  searchParams: Promise<{ shop?: string }>;
}) {
  const organization = await getStorefrontOrganization();
  if (!organization) {
    notFound();
  }

  const { variantId } = await params;
  const { shop: requestedShopId } = await searchParams;
  const shopId = await resolveStorefrontShopId(organization.id, requestedShopId);
  if (!shopId) {
    notFound();
  }

  const item = await withTenantContext({ organizationId: organization.id, shopId }, (tx) =>
    getStorefrontProductDetail(tx, shopId, variantId),
  );

  if (!item) {
    notFound();
  }

  const attrLabel = Object.values(item.attributs).join(", ");

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <Link href="/" className="text-sm text-primary underline-offset-4 hover:underline">
        ← Retour au catalogue
      </Link>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <ProductGallery
          imageIds={item.imageIds}
          productId={item.productId}
          designation={item.designation}
        />

        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {item.designation}
              {attrLabel ? ` — ${attrLabel}` : ""}
            </h1>
            {item.categoryName && (
              <p className="text-sm text-muted-foreground">{item.categoryName}</p>
            )}
          </div>

          <p className="num text-2xl font-semibold text-foreground">
            {formatMoney(item.prixVente, organization.devise)}
          </p>

          <span className={item.available ? "text-sm text-primary" : "text-sm text-muted-foreground"}>
            {item.available ? "En stock" : "Indisponible"}
          </span>

          {item.description && (
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{item.description}</p>
          )}

          <DetailAddToCart
            variantId={item.variantId}
            designation={item.designation}
            prixVente={item.prixVente}
            shopId={shopId}
            available={item.available}
          />
        </div>
      </div>
    </div>
  );
}
