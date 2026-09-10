import Link from "next/link";
import { redirect } from "next/navigation";

import { withTenantContext } from "@/lib/db/tenant-context";
import { systemPrisma } from "@/lib/db/system-client";
import { formatMoney } from "@/lib/money";
import { hasCapability } from "@/lib/permissions";
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";
import { profileHasLots, profileHasSerialNumbers } from "@/lib/tenant/profile";

import { ProductsTable, type ProductRow } from "./products-table";

export default async function ProductsPage() {
  const ctx = await getTenantContext();
  if (!hasCapability(ctx.role, "catalog:read")) {
    redirect("/");
  }

  const shopId = await getActiveShopId(ctx.organizationId, ctx.userId);
  const organization = await systemPrisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
  });

  const [products, categories] = await withTenantContext(
    { organizationId: ctx.organizationId, shopId },
    async (tx) => {
      const products = await tx.product.findMany({
        orderBy: { designation: "asc" },
        include: {
          category: true,
          variants: { include: { shopPrices: { where: { shopId } } } },
        },
      });
      const categories = await tx.category.findMany({ orderBy: { nom: "asc" } });
      return [products, categories] as const;
    },
  );

  const canWrite = hasCapability(ctx.role, "catalog:write");
  const showLots = profileHasLots(organization.profilMetier);
  const showSerial = profileHasSerialNumbers(organization.profilMetier);

  const rows: ProductRow[] = products.map((p) => {
    const price = p.variants[0]?.shopPrices[0];
    return {
      id: p.id,
      reference: p.reference,
      designation: p.designation,
      categoryName: p.category?.nom ?? null,
      priceLabel: price ? formatMoney(price.prixVente, organization.devise) : "—",
      priceValue: price ? Number(price.prixVente) : 0,
      stockSuivi: p.suiviStock,
      activeVariants: p.variants.filter((v) => v.actif).length,
      lotsHref: p.suiviLots ? `/catalog/products/${p.id}/lots` : null,
      serialHref: p.suiviSerie ? `/catalog/products/${p.id}/serial-numbers` : null,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Produits</h1>
          <p className="text-sm text-muted-foreground">
            Catalogue mutualisé au niveau de l&apos;organisation, prix par boutique.
          </p>
        </div>
        {showSerial && (
          <Link
            href="/catalog/serial-numbers"
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            Rechercher un numéro de série
          </Link>
        )}
      </header>

      <ProductsTable
        products={rows}
        categories={categories.map((c) => ({ id: c.id, nom: c.nom }))}
        canWrite={canWrite}
        showLots={showLots}
        showSerial={showSerial}
      />
    </div>
  );
}
