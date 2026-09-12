import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { systemPrisma } from "@/lib/db/system-client";
import { withTenantContext } from "@/lib/db/tenant-context";
import { hasCapability } from "@/lib/permissions";
import { getTenantContext } from "@/lib/tenant/context";

import { CancelSaleForm } from "../cancel-sale-form";
import { PrintableTicket } from "@/app/(pos)/caisse/printable-ticket";

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ saleId: string }>;
}) {
  const ctx = await getTenantContext();
  if (!hasCapability(ctx.role, "reports:read") && !hasCapability(ctx.role, "pos:cancel_ticket")) {
    redirect("/");
  }

  const { saleId } = await params;
  const organization = await systemPrisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
  });

  const sale = await withTenantContext({ organizationId: ctx.organizationId }, (tx) =>
    tx.sale.findUniqueOrThrow({
      where: { id: saleId },
      include: {
        lines: { include: { variant: { include: { product: true } } } },
        payments: true,
        customer: true,
      },
    }),
  );

  const canCancel = hasCapability(ctx.role, "pos:cancel_ticket");

  return (
    <div className="flex flex-col gap-8">
      <header>
        <Link href="/sales" className="text-sm text-primary underline-offset-4 hover:underline">
          ← Retour aux ventes
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-xl font-semibold text-foreground">Ticket {sale.numero}</h1>
          <Badge variant={sale.statut === "VALIDEE" ? "success" : "destructive"}>
            {sale.statut === "VALIDEE" ? "Validée" : "Annulée"}
          </Badge>
        </div>
        {sale.customer && (
          <p className="mt-1 text-sm text-muted-foreground">Client : {sale.customer.nom}</p>
        )}
      </header>

      <div className="rounded-xl border border-border bg-card p-6">
        <PrintableTicket
          ticket={{
            numero: sale.numero,
            createdAt: sale.createdAt.toISOString(),
            organizationNom: organization.nom,
            lines: sale.lines.map((l) => ({
              designation: l.variant.product.designation,
              quantite: Number(l.quantite),
              prixUnitaire: Number(l.prixUnitaire),
              remise: Number(l.remise),
            })),
            payments: sale.payments.map((p) => ({ mode: p.mode, montant: Number(p.montant) })),
            totalTtc: Number(sale.totalTtc),
            devise: organization.devise,
          }}
        />
      </div>

      {canCancel && sale.statut === "VALIDEE" && <CancelSaleForm saleId={sale.id} />}
    </div>
  );
}
