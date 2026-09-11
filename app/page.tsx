import {
  ArrowRight,
  BarChart3,
  Boxes,
  Check,
  ChevronDown,
  ShoppingBag,
  ShoppingCart,
  Store,
  Users,
  WifiOff,
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

function ContactButton({ className = "" }: { className?: string }) {
  return (
    <Button render={<Link href="#contact" />} nativeButton={false} className={`gap-1.5 rounded-full ${className}`}>
      Nous contacter
      <ArrowRight className="size-4" />
    </Button>
  );
}

async function MarketingHome() {
  return (
    <div className="flex flex-1 flex-col bg-background">
      {/* En-tête */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-card px-6 py-3 lg:px-16">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo statique du produit, pas un asset d'organisation */}
          <img src="/logo.png" alt="" className="size-8 rounded-md" />
          <span className="font-semibold text-foreground">Tacynt Shop</span>
        </div>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <Link href="#accueil" className="hover:text-foreground">
            Accueil
          </Link>
          <Link href="#fonctionnalites" className="hover:text-foreground">
            Fonctionnalités
          </Link>
          <Link href="#pourquoi" className="hover:text-foreground">
            Pourquoi nous
          </Link>
          <Link href="#contact" className="hover:text-foreground">
            Contact
          </Link>
        </nav>
        <ContactButton />
      </header>

      {/* Hero */}
      <section
        id="accueil"
        className="grid grid-cols-1 items-center gap-10 bg-primary/5 px-6 py-20 lg:grid-cols-2 lg:px-16"
      >
        <div className="flex flex-col items-start gap-5">
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">
            Gestion de boutique
          </p>
          <h1 className="text-3xl font-semibold text-foreground sm:text-4xl lg:text-5xl">
            Le SaaS de gestion de boutique qui encaisse même hors ligne.
          </h1>
          <p className="max-w-md text-muted-foreground">
            Caisse, stock, clients et rapports pour les commerces qui ne peuvent pas se permettre
            une connexion instable.
          </p>
          <div className="flex items-center gap-4">
            <ContactButton />
            <Link href="#fonctionnalites" className="flex items-center gap-2 text-sm font-medium text-foreground">
              <span className="flex size-9 items-center justify-center rounded-full border border-primary/30 bg-card text-primary">
                <ChevronDown className="size-4" />
              </span>
              Voir les fonctionnalités
            </Link>
          </div>
        </div>
        <div className="relative hidden lg:block">
          <div className="relative mx-auto aspect-square max-w-sm">
            <div className="absolute inset-6 rounded-[2rem] bg-primary/10" />
            <div className="absolute inset-0 flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-lg">
              <span className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <ShoppingCart className="size-5" />
              </span>
              <p className="text-sm font-medium text-foreground">Vente encaissée</p>
              <p className="num text-2xl font-semibold text-foreground">12 400 XOF</p>
              <div className="mt-auto flex items-center gap-2 text-xs text-success">
                <Check className="size-3.5" /> Synchronisé
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pourquoi Tacynt Shop */}
      <section
        id="pourquoi"
        className="grid grid-cols-1 items-center gap-10 px-6 py-20 lg:grid-cols-2 lg:px-16"
      >
        <div className="relative order-2 lg:order-1">
          <div className="absolute -top-4 -left-4 size-24 rounded-full bg-primary/10" />
          <div className="absolute -right-4 -bottom-6 size-32 rounded-[2rem] bg-primary/5" />
          <div className="relative flex flex-col gap-4 rounded-2xl border border-border bg-card p-8">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <WifiOff className="size-5" />
            </span>
            <h3 className="text-lg font-semibold text-foreground">
              Conçu pour l&apos;instabilité réseau
            </h3>
            <p className="text-sm text-muted-foreground">
              Chaque vente est enregistrée localement puis synchronisée dès que la connexion
              revient — jamais de caisse bloquée.
            </p>
          </div>
        </div>
        <div className="order-1 flex flex-col items-start gap-4 lg:order-2">
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">
            Pourquoi Tacynt Shop
          </p>
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">
            Une gestion simplifiée grâce à la <span className="text-primary">technologie</span>
          </h2>
          <p className="text-muted-foreground">
            Construit pour les commerces qui ont besoin de fiabilité au quotidien : la caisse
            fonctionne même sans réseau, et chaque boutique garde son propre stock et ses propres
            prix.
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground uppercase">
              Hors ligne d&apos;abord
            </span>
            <span className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-muted-foreground uppercase">
              Multi-boutique
            </span>
          </div>
          <Link
            href="#fonctionnalites"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Voir toutes les fonctionnalités →
          </Link>
        </div>
      </section>

      {/* Fonctionnalités (section contrastée) */}
      <section id="fonctionnalites" className="bg-foreground px-6 py-20 text-background lg:px-16">
        <div className="mx-auto flex max-w-5xl flex-col gap-10">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-semibold tracking-widest text-primary uppercase">
                Ce que vous obtenez
              </p>
              <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">
                Toutes les fonctionnalités pour <span className="text-primary">votre commerce</span>
              </h2>
            </div>
            <ContactButton />
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-background p-6 text-foreground"
                >
                  <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Icon className="size-4.5" />
                  </span>
                  <h3 className="font-semibold">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pourquoi nous choisir */}
      <section className="grid grid-cols-1 items-center gap-10 px-6 py-20 lg:grid-cols-2 lg:px-16">
        <div className="flex flex-col items-start gap-4">
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">
            Pourquoi nous choisir
          </p>
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">
            Une plateforme pensée pour les commerces qui{" "}
            <span className="text-primary">ne s&apos;arrêtent jamais</span>
          </h2>
          <p className="text-muted-foreground">
            Chaque fonctionnalité part d&apos;un besoin réel de terrain, pas d&apos;une liste de
            cases à cocher marketing.
          </p>
          <ul className="flex flex-col gap-3">
            {["Fonctionne même sans connexion internet", "Multi-boutique et multi-caisse inclus"].map(
              (item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-foreground">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Check className="size-3.5" />
                  </span>
                  {item}
                </li>
              ),
            )}
          </ul>
          <ContactButton />
        </div>
        <div className="hidden grid-cols-2 gap-4 lg:grid">
          {FEATURES.slice(0, 4).map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-6 text-center"
              >
                <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="size-4.5" />
                </span>
                <span className="text-xs font-medium text-foreground">{feature.title}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="border-t border-border bg-primary/5 px-6 py-20">
        <div className="mx-auto flex max-w-lg flex-col gap-6">
          <div className="text-center">
            <p className="text-xs font-semibold tracking-widest text-primary uppercase">Contact</p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">Ouvrir votre boutique</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Les comptes sont créés par notre équipe — parlez-nous de votre projet et nous
              revenons vers vous.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <ContactForm />
          </div>
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
