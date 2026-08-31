import Link from "next/link";
import { headers } from "next/headers";

import { Button } from "@/components/ui/button";
import { systemPrisma } from "@/lib/db/system-client";
import { withTenantContext } from "@/lib/db/tenant-context";
import { formatMoney } from "@/lib/money";
import { hasCapability, type Role } from "@/lib/permissions";
import { getDailyReport } from "@/lib/reports/daily";
import { getActiveShopId } from "@/lib/tenant/active-shop";

async function MarketingHome() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-background px-6 py-16 text-center">
      <p className="text-xs font-medium tracking-widest text-subtle-foreground uppercase">
        Tacynt Shop
      </p>
      <h1 className="max-w-xl text-3xl font-semibold text-foreground">
        Le SaaS de gestion de boutique qui encaisse même hors ligne.
      </h1>
      <Button render={<Link href="/signup" />} nativeButton={false}>
        Créer ma boutique
      </Button>
    </div>
  );
}

// Rendu uniquement si proxy.ts a déjà validé une session pour cette
// organisation (sinon la requête n'atteint jamais cette page — voir
// proxy.ts) : place-tenant minimal en attendant le vrai tableau de bord
// (jalon M8).
async function AuthenticatedHome({
  organizationId,
  userId,
  role,
}: {
  organizationId: string;
  userId: string;
  role: Role;
}) {
  const [organization, user] = await Promise.all([
    systemPrisma.organization.findUnique({ where: { id: organizationId } }),
    systemPrisma.user.findUnique({ where: { id: userId } }),
  ]);
  const canSeeCatalog = hasCapability(role, "catalog:read");
  const canSeeStock = hasCapability(role, "stock:read");
  const canSell = hasCapability(role, "pos:sell");
  const canManageUsers = hasCapability(role, "users:manage");
  const canSeeReports = hasCapability(role, "reports:read");

  const report = canSeeReports
    ? await (async () => {
        const shopId = await getActiveShopId(organizationId, userId);
        return withTenantContext({ organizationId, shopId }, (tx) => getDailyReport(tx, shopId));
      })()
    : null;

  return (
    <div className="flex flex-1 flex-col items-center bg-background px-6 py-16">
      <div className="flex w-full max-w-3xl flex-col gap-6">
        <header className="flex items-center justify-between border-b border-border pb-6">
          <div>
            <h1 className="text-xl font-semibold text-foreground">{organization?.nom}</h1>
            <p className="text-sm text-muted-foreground">Connecté en tant que {user?.email}</p>
          </div>
          <form action="/api/auth/logout" method="POST">
            <Button type="submit" variant="outline">
              Se déconnecter
            </Button>
          </form>
        </header>
        <div className="flex flex-wrap gap-2">
          {canSell && (
            <Button render={<Link href="/caisse" />} nativeButton={false}>
              Caisse
            </Button>
          )}
          {canSeeCatalog && (
            <>
              <Button variant="outline" render={<Link href="/catalog/products" />} nativeButton={false}>
                Produits
              </Button>
              <Button
                variant="outline"
                render={<Link href="/catalog/categories" />}
                nativeButton={false}
              >
                Catégories
              </Button>
            </>
          )}
          {canSeeStock && (
            <Button variant="outline" render={<Link href="/stock/movements" />} nativeButton={false}>
              Stock
            </Button>
          )}
          {canManageUsers && (
            <Button variant="outline" render={<Link href="/users" />} nativeButton={false}>
              Utilisateurs
            </Button>
          )}
          <Button variant="ghost" render={<Link href="/security" />} nativeButton={false}>
            Sécurité
          </Button>
        </div>

        {report && organization && (
          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-medium text-foreground">Aujourd&apos;hui</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase">
                  Chiffre d&apos;affaires
                </p>
                <p className="num text-2xl font-semibold text-foreground">
                  {formatMoney(report.caDuJour, organization.devise)}
                </p>
                {report.variationPourcent !== null && (
                  <p
                    className={`text-xs ${report.variationPourcent >= 0 ? "text-success" : "text-destructive"}`}
                  >
                    {report.variationPourcent >= 0 ? "+" : ""}
                    {report.variationPourcent.toFixed(1)}% vs même jour semaine dernière
                  </p>
                )}
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase">Tickets</p>
                <p className="num text-2xl font-semibold text-foreground">
                  {report.nombreTickets}
                </p>
                <p className="num text-xs text-muted-foreground">
                  Panier moyen : {formatMoney(report.panierMoyen, organization.devise)}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase">
                  Marge brute
                </p>
                <p className="num text-2xl font-semibold text-foreground">
                  {formatMoney(report.margeBrute, organization.devise)}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase">
                  Espèces en caisse
                </p>
                <p className="num text-2xl font-semibold text-foreground">
                  {formatMoney(report.especesEnCaisse, organization.devise)}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase">
                  Ruptures actives
                </p>
                <p className="num text-2xl font-semibold text-foreground">
                  {report.rupturesActives}
                </p>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default async function Home() {
  const h = await headers();
  const organizationId = h.get("x-tenant-org-id");
  const userId = h.get("x-user-id");
  const role = h.get("x-user-role") as Role | null;

  if (!organizationId || !userId || !role) {
    return <MarketingHome />;
  }

  return <AuthenticatedHome organizationId={organizationId} userId={userId} role={role} />;
}
