import { redirect } from "next/navigation";

import { systemPrisma } from "@/lib/db/system-client";
import { withTenantContext } from "@/lib/db/tenant-context";
import { formatMoney } from "@/lib/money";
import { hasCapability } from "@/lib/permissions";
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";

import { SalesTable, type SaleRow } from "./sales-table";

export default async function SalesPage() {
  const ctx = await getTenantContext();
  if (!hasCapability(ctx.role, "reports:read") && !hasCapability(ctx.role, "pos:cancel_ticket")) {
    redirect("/dashboard");
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
      include: {
        lines: { include: { variant: { include: { product: true } } } },
        payments: true,
        customer: true,
      },
    }),
  );

  const canCancel = hasCapability(ctx.role, "pos:cancel_ticket");

  const rows: SaleRow[] = sales.map((s) => ({
    id: s.id,
    numero: s.numero,
    createdAtLabel: s.createdAt.toLocaleString("fr-FR"),
    totalLabel: formatMoney(s.totalTtc, organization.devise),
    statut: s.statut,
    customerNom: s.customer?.nom ?? null,
    ticket: {
      numero: s.numero,
      createdAt: s.createdAt.toISOString(),
      organizationNom: organization.nom,
      lines: s.lines.map((l) => ({
        designation: l.variant.product.designation,
        quantite: Number(l.quantite),
        prixUnitaire: Number(l.prixUnitaire),
        remise: Number(l.remise),
      })),
      payments: s.payments.map((p) => ({ mode: p.mode, montant: Number(p.montant) })),
      totalHt: Number(s.totalHt),
      totalTtc: Number(s.totalTtc),
      devise: organization.devise,
    },
  }));

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Ventes</h1>
        <p className="text-sm text-muted-foreground">
          Derniers tickets de la boutique. Un ticket annulé n&apos;est jamais supprimé.
        </p>
      </header>

      <SalesTable sales={rows} canCancel={canCancel} />
    </div>
  );
}
