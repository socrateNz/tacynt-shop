import Link from "next/link";
import { redirect } from "next/navigation";

import { hasCapability } from "@/lib/permissions";
import { getTenantContext } from "@/lib/tenant/context";

const REPORTS = [
  { href: "/reports/ventes", label: "Ventes", desc: "Par période, vendeur, catégorie, mode de paiement" },
  { href: "/reports/marges", label: "Marges", desc: "Par produit et par catégorie, CA − coût CUMP" },
  { href: "/reports/rotation", label: "Rotation", desc: "Produits les plus vendus, dormants, taux de rotation" },
  { href: "/reports/stock", label: "Stock", desc: "Valorisation totale, écarts d'inventaire, mouvements" },
  { href: "/reports/tresorerie", label: "Trésorerie", desc: "Encaissements, dépenses, solde net" },
  { href: "/reports/creances", label: "Créances", desc: "Balance âgée des ardoises clients" },
  { href: "/reports/personnel", label: "Personnel", desc: "CA par vendeur, remises accordées, annulations" },
];

export default async function ReportsPage() {
  const ctx = await getTenantContext();
  if (!hasCapability(ctx.role, "reports:read")) {
    redirect("/");
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Rapports</h1>
        <p className="text-sm text-muted-foreground">
          Exports Excel, CSV et PDF disponibles sur chaque rapport.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {REPORTS.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="rounded-xl border border-border bg-card p-4 hover:border-primary"
          >
            <p className="text-sm font-medium text-foreground">{r.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{r.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
