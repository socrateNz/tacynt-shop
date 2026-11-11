import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, Boxes, ChevronRight, HandCoins, Percent, RefreshCw, TrendingUp, Users, Wallet } from "lucide-react";

import { Page, PageHeader } from "@/components/admin/page";
import { systemPrisma } from "@/lib/db/system-client";
import { hasCapability } from "@/lib/permissions";
import { getTenantContext } from "@/lib/tenant/context";
import { organizationHasModule } from "@/lib/tenant/modules";

const REPORTS = [
  { href: "/reports/ventes", icon: TrendingUp, label: "Ventes", desc: "Par période, vendeur, catégorie, mode de paiement" },
  { href: "/reports/marges", icon: Percent, label: "Marges", desc: "Par produit et par catégorie, CA − coût CUMP" },
  { href: "/reports/rotation", icon: RefreshCw, label: "Rotation", desc: "Produits les plus vendus, dormants, taux de rotation" },
  { href: "/reports/stock", icon: Boxes, label: "Stock", desc: "Valorisation totale, écarts d'inventaire, mouvements" },
  { href: "/reports/tresorerie", icon: Wallet, label: "Trésorerie", desc: "Encaissements, dépenses, solde net" },
  { href: "/reports/creances", icon: HandCoins, label: "Créances", desc: "Balance âgée des ardoises clients" },
  { href: "/reports/personnel", icon: Users, label: "Personnel", desc: "CA par vendeur, remises accordées, annulations" },
];

export default async function ReportsPage() {
  const ctx = await getTenantContext();
  if (!hasCapability(ctx.role, "reports:read")) {
    redirect("/dashboard");
  }

  const organization = await systemPrisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
  });
  const showComptabilite =
    hasCapability(ctx.role, "accounting:manage") &&
    organizationHasModule(organization.enabledModules, "accounting_connectors");

  const reports = showComptabilite
    ? [
        ...REPORTS,
        {
          href: "/reports/comptabilite",
          icon: BookOpen,
          label: "Comptabilité",
          desc: "Journal débit/crédit exportable (module premium)",
        },
      ]
    : REPORTS;

  return (
    <Page>
      <PageHeader
        title="Rapports"
        description="Choisissez un rapport. Chacun s'exporte en Excel, CSV ou PDF."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {reports.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-card transition-colors hover:border-primary/50"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <r.icon className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">{r.label}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{r.desc}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        ))}
      </div>
    </Page>
  );
}
