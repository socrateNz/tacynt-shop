import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
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

import { CancelSaleForm } from "./cancel-sale-form";

export default async function SalesPage() {
  const ctx = await getTenantContext();
  if (!hasCapability(ctx.role, "reports:read") && !hasCapability(ctx.role, "pos:cancel_ticket")) {
    redirect("/");
  }

  const shopId = await getActiveShopId(ctx.organizationId, ctx.userId);
  const organization = await systemPrisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
  });

  const sales = await withTenantContext({ organizationId: ctx.organizationId, shopId }, (tx) =>
    tx.sale.findMany({
      where: { shopId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  );

  const canCancel = hasCapability(ctx.role, "pos:cancel_ticket");

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Ventes</h1>
        <p className="text-sm text-muted-foreground">
          Derniers tickets de la boutique. Un ticket annulé n&apos;est jamais supprimé.
        </p>
      </header>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Numéro</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Statut</TableHead>
              {canCancel && <TableHead>Action</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="num text-foreground">{s.numero}</TableCell>
                <TableCell className="text-muted-foreground">
                  {s.createdAt.toLocaleString("fr-FR")}
                </TableCell>
                <TableCell className="num text-right">
                  {formatMoney(s.totalTtc, organization.devise)}
                </TableCell>
                <TableCell>
                  <Badge variant={s.statut === "VALIDEE" ? "success" : "destructive"}>
                    {s.statut === "VALIDEE" ? "Validée" : "Annulée"}
                  </Badge>
                </TableCell>
                {canCancel && (
                  <TableCell>{s.statut === "VALIDEE" && <CancelSaleForm saleId={s.id} />}</TableCell>
                )}
              </TableRow>
            ))}
            {sales.length === 0 && (
              <TableRow>
                <TableCell colSpan={canCancel ? 5 : 4} className="text-center text-muted-foreground">
                  Aucune vente pour l&apos;instant.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
