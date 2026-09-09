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

export default async function ProductSerialNumbersPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const ctx = await getTenantContext();
  if (!hasCapability(ctx.role, "stock:read")) {
    redirect("/");
  }

  const { productId } = await params;
  const shopId = await getActiveShopId(ctx.organizationId, ctx.userId);

  const { product, serialNumbers } = await withTenantContext(
    { organizationId: ctx.organizationId, shopId },
    async (tx) => {
      const product = await tx.product.findUniqueOrThrow({
        where: { id: productId },
        include: { variants: true },
      });
      const serialNumbers = await tx.serialNumber.findMany({
        where: { shopId, variantId: { in: product.variants.map((v) => v.id) } },
        include: {
          variant: true,
          saleLine: { include: { sale: true } },
        },
        orderBy: [{ statut: "asc" }, { receivedAt: "asc" }],
      });
      return { product, serialNumbers };
    },
  );

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-xl font-semibold text-foreground">
          Numéros de série — {product.designation}
        </h1>
        <p className="text-sm text-muted-foreground">
          Un numéro se crée en réceptionnant du stock avec des numéros de série (
          <Link href="/stock/movements" className="text-primary underline-offset-4 hover:underline">
            Stock → Réception
          </Link>
          ). Affectation à la vente automatique, en FIFO.
        </p>
      </header>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Variante</TableHead>
              <TableHead>N° de série</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Reçu le</TableHead>
              <TableHead>Vente</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {serialNumbers.map((s) => {
              const attrs = s.variant.attributs as Record<string, string>;
              const attrLabel = Object.values(attrs).join(", ");
              return (
                <TableRow key={s.id}>
                  <TableCell className="text-foreground">
                    {attrLabel || product.designation}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{s.numero}</TableCell>
                  <TableCell
                    className={s.statut === "VENDU" ? "text-muted-foreground" : "text-foreground"}
                  >
                    {s.statut === "VENDU" ? "Vendu" : "En stock"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.receivedAt.toLocaleDateString("fr-FR")}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.saleLine ? s.saleLine.sale.numero : "—"}
                  </TableCell>
                </TableRow>
              );
            })}
            {serialNumbers.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Aucun numéro de série pour l&apos;instant.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
