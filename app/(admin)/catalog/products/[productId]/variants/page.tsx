import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { systemPrisma } from "@/lib/db/system-client";
import { withTenantContext } from "@/lib/db/tenant-context";
import { formatMoney } from "@/lib/money";
import { hasCapability } from "@/lib/permissions";
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";

import { deactivateVariant } from "./actions";
import { VariantForm } from "./variant-form";

export default async function ProductVariantsPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const ctx = await getTenantContext();
  if (!hasCapability(ctx.role, "catalog:read")) {
    redirect("/");
  }

  const { productId } = await params;
  const shopId = await getActiveShopId(ctx.organizationId, ctx.userId);
  const organization = await systemPrisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
  });

  const { product, variants } = await withTenantContext(
    { organizationId: ctx.organizationId, shopId },
    async (tx) => {
      const product = await tx.product.findUniqueOrThrow({ where: { id: productId } });
      const variants = await tx.productVariant.findMany({
        where: { productId },
        include: { shopPrices: { where: { shopId } } },
        orderBy: { id: "asc" },
      });
      return { product, variants };
    },
  );

  const canWrite = hasCapability(ctx.role, "catalog:write");

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-xl font-semibold text-foreground">
          Variantes — {product.designation}
        </h1>
        <p className="text-sm text-muted-foreground">
          Chaque combinaison d&apos;attributs est une unité de stock distincte avec son propre
          code-barres.
        </p>
      </header>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Attributs</TableHead>
              <TableHead>Code-barres</TableHead>
              <TableHead className="text-right">Prix de vente</TableHead>
              <TableHead>Statut</TableHead>
              {canWrite && <TableHead>Action</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {variants.map((v) => {
              const attrs = v.attributs as Record<string, string>;
              const attrLabel =
                Object.entries(attrs).length > 0
                  ? Object.entries(attrs)
                      .map(([k, val]) => `${k}: ${val}`)
                      .join(", ")
                  : "—";
              const price = v.shopPrices[0];
              return (
                <TableRow key={v.id}>
                  <TableCell className="text-foreground">{attrLabel}</TableCell>
                  <TableCell className="num text-muted-foreground">
                    {v.codeBarres ?? "—"}
                  </TableCell>
                  <TableCell className="num text-right">
                    {price ? formatMoney(price.prixVente, organization.devise) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={v.actif ? "success" : "secondary"}>
                      {v.actif ? "Active" : "Désactivée"}
                    </Badge>
                  </TableCell>
                  {canWrite && (
                    <TableCell>
                      {v.actif && (
                        <form action={deactivateVariant}>
                          <input type="hidden" name="variantId" value={v.id} />
                          <input type="hidden" name="productId" value={productId} />
                          <Button type="submit" variant="ghost" size="sm">
                            Désactiver
                          </Button>
                        </form>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {canWrite && <VariantForm productId={productId} />}
    </div>
  );
}
