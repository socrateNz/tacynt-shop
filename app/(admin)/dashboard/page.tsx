import Link from "next/link";
import { BarChart3, ReceiptText, ShoppingBasket, ShoppingCart, Wallet } from "lucide-react";

import { Page, PageHeader, StatCard, StatGrid, TablePanel } from "@/components/admin/page";
import { buttonVariants } from "@/components/ui/button";
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
    <Page>
      <PageHeader
        title="Tableau de bord"
        description={<>{organization.nom} — 30 derniers jours</>}
        actions={
          <>
            {canSeeReports && (
              <Link href="/reports" className={buttonVariants({ variant: "outline" })}>
                <BarChart3 />
                Rapports
              </Link>
            )}
            {hasCapability(ctx.role, "pos:sell") && (
              <Link href="/caisse" className={buttonVariants()}>
                <ShoppingCart />
                Ouvrir la caisse
              </Link>
            )}
          </>
        }
      />

      <StatGrid className="lg:grid-cols-3">
        <StatCard
          label="Chiffre d'affaires"
          value={formatMoney(overview.chiffreAffaires, organization.devise)}
          icon={Wallet}
          hint="30 derniers jours"
        />
        <StatCard label="Ventes" value={overview.nombreVentes} icon={ReceiptText} hint="30 derniers jours" />
        <StatCard
          label="Panier moyen"
          value={formatMoney(overview.panierMoyen, organization.devise)}
          icon={ShoppingBasket}
          hint="30 derniers jours"
          className="col-span-2 lg:col-span-1"
        />
      </StatGrid>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <h2 className="mb-4 text-base font-semibold text-foreground">Ventes dans le temps</h2>
          <SalesChart data={overview.salesByDay} />
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <h2 className="mb-4 text-base font-semibold text-foreground">Produits les plus vendus</h2>
          {overview.topProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune vente sur cette période.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {overview.topProducts.map((p) => (
                <li key={p.productId} className="flex items-center gap-3">
                  {p.coverImageId ? (
                    // eslint-disable-next-line @next/next/no-img-element -- image binaire servie par la route, pas un asset statique optimisable
                    <img
                      src={`/api/products/${p.productId}/images/${p.coverImageId}`}
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

      <TablePanel>
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold text-foreground">Ventes récentes</h2>
          <Link href="/sales" className="text-sm font-medium text-primary hover:underline">
            Toutes les ventes
          </Link>
        </div>
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
      </TablePanel>
    </Page>
  );
}
