import Link from "next/link";
import { redirect } from "next/navigation";
import { ShoppingCart } from "lucide-react";

import { Page, PageHeader } from "@/components/admin/page";
import { buttonVariants } from "@/components/ui/button";
import { systemPrisma } from "@/lib/db/system-client";
import { withTenantContext } from "@/lib/db/tenant-context";
import { formatMoney } from "@/lib/money";
import { hasCapability } from "@/lib/permissions";
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";

import { SalesTable, type SaleRow } from "./sales-table";

// Même format que app/api/pos/catalog/route.ts (designation de la caisse en
// direct) : un ticket réimprimé depuis l'historique doit afficher la variante
// exactement comme à l'impression d'origine.
function lineDesignation(variant: { product: { designation: string }; attributs: unknown }): string {
  const attrs = variant.attributs as Record<string, string>;
  const attrLabel = Object.values(attrs).join(", ");
  return attrLabel ? `${variant.product.designation} (${attrLabel})` : variant.product.designation;
}

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
        designation: lineDesignation(l.variant),
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
    <Page>
      <PageHeader
        title="Ventes"
        description={<>Les 50 derniers tickets de la boutique. Cliquez sur un ticket pour le réimprimer ou l&apos;annuler.</>}
        actions={
          hasCapability(ctx.role, "pos:sell") ? (
            <Link href="/caisse" className={buttonVariants()}>
              <ShoppingCart />
              Ouvrir la caisse
            </Link>
          ) : undefined
        }
      />

      <SalesTable sales={rows} canCancel={canCancel} />
    </Page>
  );
}
