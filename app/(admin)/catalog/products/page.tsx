import { redirect } from "next/navigation";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { withTenantContext } from "@/lib/db/tenant-context";
import { systemPrisma } from "@/lib/db/system-client";
import { formatMoney } from "@/lib/money";
import { hasCapability } from "@/lib/permissions";
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";

import { ProductForm } from "./product-form";

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

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Produits</h1>
        <p className="text-sm text-muted-foreground">
          Catalogue mutualisé au niveau de l&apos;organisation, prix par boutique.
        </p>
      </header>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Référence</TableHead>
              <TableHead>Désignation</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead className="text-right">Prix de vente</TableHead>
              <TableHead>Stock suivi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((p) => {
              const price = p.variants[0]?.shopPrices[0];
              return (
                <TableRow key={p.id}>
                  <TableCell className="num text-muted-foreground">{p.reference}</TableCell>
                  <TableCell className="text-foreground">{p.designation}</TableCell>
                  <TableCell className="text-muted-foreground">{p.category?.nom ?? "—"}</TableCell>
                  <TableCell className="num text-right">
                    {price ? formatMoney(price.prixVente, organization.devise) : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.suiviStock ? "Oui" : "Non"}
                  </TableCell>
                </TableRow>
              );
            })}
            {products.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Aucun produit pour l&apos;instant.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {canWrite && (
        <ProductForm categories={categories.map((c) => ({ id: c.id, nom: c.nom }))} />
      )}
    </div>
  );
}
