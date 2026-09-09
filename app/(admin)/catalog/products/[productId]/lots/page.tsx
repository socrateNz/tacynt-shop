import Link from "next/link";
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
import { hasCapability } from "@/lib/permissions";
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";

export default async function ProductLotsPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const ctx = await getTenantContext();
  const now = new Date();
  if (!hasCapability(ctx.role, "stock:read")) {
    redirect("/");
  }

  const { productId } = await params;
  const shopId = await getActiveShopId(ctx.organizationId, ctx.userId);

  const { product, lots } = await withTenantContext(
    { organizationId: ctx.organizationId, shopId },
    async (tx) => {
      const product = await tx.product.findUniqueOrThrow({
        where: { id: productId },
        include: { variants: true },
      });
      const lots = await tx.lot.findMany({
        where: { shopId, variantId: { in: product.variants.map((v) => v.id) } },
        include: { variant: true },
        orderBy: [{ datePeremption: "asc" }, { numero: "asc" }],
      });
      return { product, lots };
    },
  );

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Lots — {product.designation}</h1>
        <p className="text-sm text-muted-foreground">
          Un lot se crée en réceptionnant du stock avec un numéro de lot (
          <Link href="/stock/movements" className="text-primary underline-offset-4 hover:underline">
            Stock → Réception
          </Link>
          ).
        </p>
      </header>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Variante</TableHead>
              <TableHead>N° de lot</TableHead>
              <TableHead>Péremption</TableHead>
              <TableHead className="text-right">Quantité restante</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lots.map((l) => {
              const attrs = l.variant.attributs as Record<string, string>;
              const attrLabel = Object.values(attrs).join(", ");
              const expired = l.datePeremption && l.datePeremption < now;
              return (
                <TableRow key={l.id}>
                  <TableCell className="text-foreground">
                    {attrLabel || product.designation}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{l.numero}</TableCell>
                  <TableCell className={expired ? "text-destructive" : "text-muted-foreground"}>
                    {l.datePeremption ? l.datePeremption.toLocaleDateString("fr-FR") : "—"}
                    {expired ? " (périmé)" : ""}
                  </TableCell>
                  <TableCell className="num text-right">{l.quantite.toString()}</TableCell>
                </TableRow>
              );
            })}
            {lots.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Aucun lot pour l&apos;instant.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
