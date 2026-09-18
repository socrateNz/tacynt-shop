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
import { getDashboardOverview } from "@/lib/reports/dashboard";
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";

import { SalesChart } from "./sales-chart";

const PAYMENT_LABELS: Record<string, string> = {
  ESPECES: "Espèces",
  MOBILE_MONEY: "Mobile Money",
  CARTE: "Carte",
  VIREMENT: "Virement",
  ARDOISE: "Ardoise",
  BON_ACHAT: "Bon d'achat",
};

// Destination post-connexion (M32, remplace l'ancien mini tableau de bord
// à "/") — jamais de redirect() ici en cas de capacité insuffisante,
// contrairement aux autres pages admin : c'est justement la page de repli
// de tout le monde, y compris les rôles sans "reports:read" (Vendeur), donc
// une redirection créerait une boucle. On dégrade simplement le contenu.
export default async function DashboardPage() {
  const ctx = await getTenantContext();
  const canSeeReports = hasCapability(ctx.role, "reports:read");

  if (!canSeeReports) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold text-foreground">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">Bienvenue.</p>
      </div>
    );
  }

  const organization = await systemPrisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
  });
  const shopId = await getActiveShopId(ctx.organizationId, ctx.userId);
  const overview = await withTenantContext({ organizationId: ctx.organizationId, shopId }, (tx) =>
    getDashboardOverview(tx, shopId),
  );

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">{organization.nom} — 30 derniers jours</p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase">
            Chiffre d&apos;affaires (30 jours)
          </p>
          <p className="num text-2xl font-semibold text-foreground">
            {formatMoney(overview.chiffreAffaires, organization.devise)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase">Ventes (30 jours)</p>
          <p className="num text-2xl font-semibold text-foreground">{overview.nombreVentes}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase">
            Panier moyen (30 jours)
          </p>
          <p className="num text-2xl font-semibold text-foreground">
            {formatMoney(overview.panierMoyen, organization.devise)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-4 text-sm font-medium text-foreground">Ventes dans le temps</h2>
          <SalesChart data={overview.salesByDay} />
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-4 text-sm font-medium text-foreground">Produits les plus vendus</h2>
          {overview.topProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune vente sur cette période.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {overview.topProducts.map((p) => (
                <li key={p.productId} className="flex items-center gap-3">
                  {p.hasImage ? (
                    // eslint-disable-next-line @next/next/no-img-element -- image binaire servie par la route, pas un asset statique optimisable
                    <img
                      src={`/api/products/${p.productId}/image`}
                      alt={p.designation}
                      className="size-10 rounded-md border border-border object-cover"
                    />
                  ) : (
                    <div className="size-10 shrink-0 rounded-md border border-dashed border-border" />
                  )}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium text-foreground">
                      {p.designation}
                    </span>
                    <span className="num text-xs text-muted-foreground">
                      {p.quantiteVendue} vendu{p.quantiteVendue > 1 ? "s" : ""}
                    </span>
                  </div>
                  <span className="num text-sm font-medium text-foreground">
                    {formatMoney(p.chiffreAffaires, organization.devise)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <h2 className="p-4 text-sm font-medium text-foreground">Ventes récentes</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Numéro</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Articles</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Paiement</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {overview.recentSales.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="text-foreground">{s.numero}</TableCell>
                <TableCell className="text-muted-foreground">
                  {s.customerNom ?? "Client comptoir"}
                </TableCell>
                <TableCell className="num text-muted-foreground">{s.nombreArticles}</TableCell>
                <TableCell className="num text-right">
                  {formatMoney(s.totalTtc, organization.devise)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {PAYMENT_LABELS[s.modePaiement] ?? s.modePaiement}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {s.createdAt.toLocaleDateString("fr-FR")}
                </TableCell>
              </TableRow>
            ))}
            {overview.recentSales.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
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
