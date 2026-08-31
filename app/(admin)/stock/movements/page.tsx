import { redirect } from "next/navigation";

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

import { AdjustStockForm } from "./adjust-stock-form";
import { ReceiveStockForm } from "./receive-stock-form";

export default async function StockMovementsPage() {
  const ctx = await getTenantContext();
  if (!hasCapability(ctx.role, "stock:read")) {
    redirect("/");
  }

  const shopId = await getActiveShopId(ctx.organizationId, ctx.userId);
  const organization = await systemPrisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
  });

  const [levels, movements, variants] = await withTenantContext(
    { organizationId: ctx.organizationId, shopId },
    async (tx) => {
      const levels = await tx.stockLevel.findMany({
        where: { shopId },
        include: { variant: { include: { product: true } } },
        orderBy: { variant: { product: { designation: "asc" } } },
      });
      const movements = await tx.stockMovement.findMany({
        where: { shopId },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { variant: { include: { product: true } } },
      });
      const variants = await tx.productVariant.findMany({
        where: { product: { suiviStock: true } },
        include: { product: true },
        orderBy: { product: { designation: "asc" } },
      });
      return [levels, movements, variants] as const;
    },
  );

  const canWrite = hasCapability(ctx.role, "stock:write");

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Stock</h1>
        <p className="text-sm text-muted-foreground">
          Le stock n&apos;est jamais une valeur qu&apos;on écrit — c&apos;est la somme des
          mouvements.
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-foreground">Niveaux actuels</h2>
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produit</TableHead>
                <TableHead className="text-right">Quantité</TableHead>
                <TableHead className="text-right">CUMP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {levels.map((l) => (
                <TableRow key={`${l.variantId}-${l.shopId}`}>
                  <TableCell className="text-foreground">
                    {l.variant.product.designation}
                  </TableCell>
                  <TableCell className="num text-right">{l.quantite.toString()}</TableCell>
                  <TableCell className="num text-right">
                    {formatMoney(l.cump, organization.devise)}
                  </TableCell>
                </TableRow>
              ))}
              {levels.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    Aucun mouvement de stock pour l&apos;instant.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {canWrite && (
        <>
          <ReceiveStockForm
            variants={variants.map((v) => ({
              id: v.id,
              label: `${v.product.designation}${v.codeBarres ? ` (${v.codeBarres})` : ""}`,
            }))}
          />
          <AdjustStockForm
            variants={variants.map((v) => ({
              id: v.id,
              label: `${v.product.designation}${v.codeBarres ? ` (${v.codeBarres})` : ""}`,
            }))}
          />
        </>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-foreground">Derniers mouvements</h2>
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Produit</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Quantité</TableHead>
                <TableHead className="text-right">Coût unitaire</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="text-muted-foreground">
                    {m.createdAt.toLocaleString("fr-FR")}
                  </TableCell>
                  <TableCell className="text-foreground">
                    {m.variant.product.designation}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{m.type}</TableCell>
                  <TableCell className="num text-right">{m.quantite.toString()}</TableCell>
                  <TableCell className="num text-right">
                    {formatMoney(m.coutUnitaire, organization.devise)}
                  </TableCell>
                </TableRow>
              ))}
              {movements.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Aucun mouvement pour l&apos;instant.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
