import {
  BarChart3,
  Boxes,
  ShoppingBag,
  ShoppingCart,
  Store,
  Users,
  type LucideIcon,
} from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { systemPrisma } from "@/lib/db/system-client";
import { withTenantContext } from "@/lib/db/tenant-context";
import { formatMoney } from "@/lib/money";
import { hasCapability, type Role } from "@/lib/permissions";
import { getDailyReport } from "@/lib/reports/daily";
import { getActiveShopId } from "@/lib/tenant/active-shop";

import { ContactForm } from "./contact-form";

type Feature = { icon: LucideIcon; title: string; description: string };

// Fonctionnalités réellement livrées (pas de promesse marketing en avance
// sur le produit) — reprises des sections déjà construites (Phases 1-4).
const FEATURES: Feature[] = [
  {
    icon: ShoppingCart,
    title: "Caisse hors ligne",
    description:
      "Encaissez même sans connexion internet — synchronisation automatique au retour du réseau.",
  },
  {
    icon: Store,
    title: "Multi-boutique",
    description: "Gérez plusieurs boutiques et postes de caisse depuis un seul compte.",
  },
  {
    icon: Boxes,
    title: "Stock avancé",
    description:
      "Suivi de stock, lots et péremption (FEFO), numéros de série — selon votre métier.",
  },
  {
    icon: Users,
    title: "Fidélité & clients",
    description: "Programme de fidélité, ardoise, historique d'achats par client.",
  },
  {
    icon: ShoppingBag,
    title: "E-commerce",
    description: "Vitrine en ligne connectée à votre stock, retrait en boutique.",
  },
  {
    icon: BarChart3,
    title: "Rapports",
    description: "Chiffre d'affaires, marges, trésorerie, en temps réel.",
  },
];

async function MarketingHome() {
  return (
    <div className="flex flex-1 flex-col bg-background">
      <section className="flex flex-col items-center gap-6 px-6 py-20 text-center">
        <p className="text-xs font-medium tracking-widest text-subtle-foreground uppercase">
          Tacynt Shop
        </p>
        <h1 className="max-w-xl text-3xl font-semibold text-foreground sm:text-4xl">
          Le SaaS de gestion de boutique qui encaisse même hors ligne.
        </h1>
        <p className="max-w-lg text-muted-foreground">
          Caisse, stock, clients et rapports pour les commerces qui ne peuvent pas se permettre
          une connexion instable.
        </p>
        <Button render={<Link href="#contact" />} nativeButton={false}>
          Nous contacter
        </Button>
      </section>

      <section className="border-t border-border bg-card px-6 py-16">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="flex flex-col gap-3 rounded-xl border border-border bg-background p-6"
              >
                <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Icon className="size-4.5" />
                </span>
                <h2 className="font-semibold text-foreground">{feature.title}</h2>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section id="contact" className="px-6 py-16">
        <div className="mx-auto flex max-w-lg flex-col gap-6">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-foreground">Ouvrir votre boutique</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Les comptes sont créés par notre équipe — parlez-nous de votre projet et nous
              revenons vers vous.
            </p>
          </div>
          <ContactForm />
        </div>
      </section>

      <footer className="border-t border-border px-6 py-6 text-center text-xs text-subtle-foreground">
        © {new Date().getFullYear()} Tacynt Shop
      </footer>
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
