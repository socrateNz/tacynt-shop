import {
  ArrowRight,
  BarChart3,
  Boxes,
  Check,
  ChevronDown,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Store,
  Users,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { notFound } from "next/navigation";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { withTenantContext } from "@/lib/db/tenant-context";
import { getStorefrontCatalog } from "@/lib/storefront/catalog";
import { getRootPageContext, resolveStorefrontShopId } from "@/lib/storefront/context";

import { CatalogueClient } from "./catalogue-client";
import { ContactForm } from "./contact-form";
import { MarketingMobileNav } from "./marketing-mobile-nav";
import { ScrollReveal } from "./scroll-reveal";
import { StorefrontShell } from "./storefront-shell";

type Feature = { icon: LucideIcon; title: string; description: string; featured?: boolean };

// Fonctionnalités réellement livrées (pas de promesse marketing en avance
// sur le produit) — reprises des sections déjà construites (Phases 1-4).
const FEATURES: Feature[] = [
  {
    icon: ShoppingCart,
    title: "Caisse hors ligne",
    description:
      "Encaissez même sans connexion internet — chaque vente est enregistrée sur l'appareil et synchronisée automatiquement au retour du réseau.",
    featured: true,
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
    icon: Smartphone,
    title: "Paiement en ligne",
    description: "Orange Money et MTN MoMo directement sur votre vitrine en ligne.",
  },
  {
    icon: Users,
    title: "Fidélité & clients",
    description: "Programme de fidélité, ardoise, historique d'achats par client.",
  },
  {
    icon: ShoppingBag,
    title: "E-commerce",
    description: "Vitrine en ligne connectée à votre stock, retrait en boutique ou livraison.",
  },
  {
    icon: BarChart3,
    title: "Rapports",
    description: "Chiffre d'affaires, marges, trésorerie, en temps réel.",
    featured: true,
  },
];

const FAQ: { question: string; answer: string }[] = [
  {
    question: "Comment je démarre ?",
    answer:
      "Vous nous contactez via le formulaire ci-dessous. Notre équipe configure votre compte, vos boutiques et vos accès — pas d'inscription en self-service pour l'instant.",
  },
  {
    question: "Est-ce que ça fonctionne sans connexion internet ?",
    answer:
      "Oui. La caisse enregistre chaque vente sur l'appareil et synchronise automatiquement dès que la connexion revient — jamais de caisse bloquée.",
  },
  {
    question: "Puis-je gérer plusieurs boutiques depuis un seul compte ?",
    answer:
      "Oui. Chaque boutique garde son propre stock, ses propres prix et son propre poste de caisse, le tout piloté depuis un seul compte.",
  },
  {
    question: "Mes clients peuvent-ils payer en ligne ?",
    answer:
      "Oui, via Orange Money et MTN MoMo sur votre vitrine en ligne, boutique par boutique selon ce que vous activez.",
  },
  {
    question: "Mes données sont-elles isolées des autres boutiques utilisant Tacynt Shop ?",
    answer:
      "Oui. Chaque organisation est strictement séparée au niveau de la base de données — vos ventes, votre stock et vos clients ne sont jamais visibles ailleurs.",
  },
  {
    question: "Ai-je besoin d'une carte bancaire pour démarrer ?",
    answer: "Non. L'abonnement est géré directement avec notre équipe, sans carte bancaire.",
  },
];

const STEPS: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: MessageCircle,
    title: "Contactez-nous",
    description: "Parlez-nous de votre boutique via le formulaire — un commerce, plusieurs, peu importe.",
  },
  {
    icon: Settings,
    title: "Votre boutique est configurée",
    description: "Notre équipe crée votre compte, vos boutiques, vos postes de caisse et vos accès.",
  },
  {
    icon: ShoppingCart,
    title: "Vous encaissez",
    description: "Caisse, stock, clients et rapports — immédiatement opérationnel, même hors ligne.",
  },
];

function ContactButton({ className = "", variant }: { className?: string; variant?: "default" | "outline" }) {
  return (
    <Button
      render={<Link href="#contact" />}
      nativeButton={false}
      variant={variant}
      className={`gap-1.5 rounded-full ${className}`}
    >
      Nous contacter
      <ArrowRight className="size-4" />
    </Button>
  );
}

async function MarketingHome() {
  return (
    <div className="flex flex-1 flex-col overflow-x-clip bg-background">
      {/* En-tête */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 px-6 py-3 backdrop-blur-md lg:px-16">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
          <Link href="#accueil" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- logo statique du produit, pas un asset d'organisation */}
            <img src="/logo.png" alt="" className="size-8 rounded-md" />
            <span className="font-semibold text-foreground">Tacynt Shop</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <Link href="#accueil" className="transition-colors hover:text-foreground">
              Accueil
            </Link>
            <Link href="#fonctionnalites" className="transition-colors hover:text-foreground">
              Fonctionnalités
            </Link>
            <Link href="#pourquoi" className="transition-colors hover:text-foreground">
              Pourquoi nous
            </Link>
            <Link href="#faq" className="transition-colors hover:text-foreground">
              FAQ
            </Link>
            <Link href="#contact" className="transition-colors hover:text-foreground">
              Contact
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <ContactButton className="hidden sm:inline-flex" />
            <MarketingMobileNav />
          </div>
        </div>
      </header>

      {/* Hero */}
      <section id="accueil" className="relative overflow-hidden px-6 pt-20 pb-24 lg:px-16 lg:pt-28">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-48 -right-32 size-128 rounded-full bg-primary/15 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -left-40 size-112 rounded-full bg-primary/10 blur-3xl"
        />
        <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <ScrollReveal className="flex flex-col items-start gap-6">
            <Badge variant="outline" className="rounded-full border-primary/30 px-3 py-1 text-primary">
              Hors ligne d&apos;abord · Multi-boutique
            </Badge>
            <h1 className="text-4xl leading-[1.08] font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              La caisse qui ne <span className="text-primary">s&apos;arrête jamais</span>.
            </h1>
            <p className="max-w-md text-base text-muted-foreground sm:text-lg">
              Caisse, stock, clients, e-commerce et rapports pour les commerces qui ne peuvent pas
              se permettre une connexion instable.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <ContactButton className="h-11 px-5 text-sm" />
              <Button
                render={<Link href="#fonctionnalites" />}
                nativeButton={false}
                variant="outline"
                className="h-11 gap-2 rounded-full px-5 text-sm"
              >
                Voir les fonctionnalités
                <ChevronDown className="size-4" />
              </Button>
            </div>
            <p className="text-xs text-subtle-foreground">
              Mise en place accompagnée par notre équipe — aucune carte bancaire requise.
            </p>
          </ScrollReveal>

          <ScrollReveal delayMs={150} className="relative hidden lg:block">
            <div className="relative mx-auto aspect-square max-w-sm">
              <div className="absolute inset-8 rounded-[2rem] bg-primary/10" />
              <div className="absolute inset-0 flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-lg">
                <span className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <ShoppingCart className="size-5" />
                </span>
                <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>3 × Boisson 33cl</span>
                    <span className="num">2 400</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Sac de riz 25kg</span>
                    <span className="num">10 000</span>
                  </div>
                </div>
                <div className="border-t border-dashed border-border pt-3">
                  <p className="num text-2xl font-semibold text-foreground">12 400 XOF</p>
                </div>
                <div className="mt-auto flex items-center gap-2 text-xs text-success">
                  <Check className="size-3.5" /> Synchronisé
                </div>
              </div>
              <div className="absolute -bottom-5 -left-8 flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-xs font-medium text-foreground shadow-lg">
                <WifiOff className="size-3.5 text-primary" />
                Hors ligne · synchro auto
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Pourquoi Tacynt Shop */}
      <section id="pourquoi" className="px-6 py-20 lg:px-16">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <ScrollReveal className="relative order-2 lg:order-1">
            <div aria-hidden className="absolute -top-4 -left-4 size-24 rounded-full bg-primary/10" />
            <div aria-hidden className="absolute -right-4 -bottom-6 size-32 rounded-[2rem] bg-primary/5" />
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
          </ScrollReveal>
          <ScrollReveal delayMs={120} className="order-1 flex flex-col items-start gap-4 lg:order-2">
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
              {["Hors ligne d'abord", "Multi-boutique", "Mobile Money", "Fidélité"].map((label, i) => (
                <span
                  key={label}
                  className={
                    i === 0
                      ? "rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground uppercase"
                      : "rounded-full border border-border px-4 py-2 text-xs font-semibold text-muted-foreground uppercase"
                  }
                >
                  {label}
                </span>
              ))}
            </div>
            <Link
              href="#fonctionnalites"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Voir toutes les fonctionnalités →
            </Link>
          </ScrollReveal>
        </div>
      </section>

      {/* Fonctionnalités (section contrastée) */}
      <section id="fonctionnalites" className="bg-foreground px-6 py-20 text-background lg:px-16">
        <div className="mx-auto flex max-w-5xl flex-col gap-10">
          <ScrollReveal className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-semibold tracking-widest text-primary uppercase">
                Ce que vous obtenez
              </p>
              <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">
                Toutes les fonctionnalités pour <span className="text-primary">votre commerce</span>
              </h2>
            </div>
            <ContactButton />
          </ScrollReveal>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <ScrollReveal
                  key={feature.title}
                  delayMs={(i % 3) * 80}
                  className={feature.featured ? "sm:col-span-2 lg:col-span-2" : undefined}
                >
                  <div className="group flex h-full flex-col gap-3 rounded-xl border border-background/10 bg-background p-6 text-foreground transition-all hover:-translate-y-1 hover:border-primary/40">
                    <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform group-hover:scale-110">
                      <Icon className="size-4.5" />
                    </span>
                    <h3 className="font-semibold">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* Comment ça marche */}
      <section className="px-6 py-20 lg:px-16">
        <div className="mx-auto flex max-w-5xl flex-col gap-12">
          <ScrollReveal className="text-center">
            <p className="text-xs font-semibold tracking-widest text-primary uppercase">
              Comment ça marche
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">
              Opérationnel en <span className="text-primary">trois étapes</span>
            </h2>
          </ScrollReveal>
          <div className="relative grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-6">
            <div
              aria-hidden
              className="absolute top-6 right-[16%] left-[16%] hidden h-px bg-border sm:block"
            />
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <ScrollReveal key={step.title} delayMs={i * 120} className="relative flex flex-col items-center gap-3 text-center">
                  <span className="relative z-10 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="font-semibold text-foreground">
                    {i + 1}. {step.title}
                  </h3>
                  <p className="max-w-xs text-sm text-muted-foreground">{step.description}</p>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* Confiance / sécurité */}
      <section className="px-6 py-20 lg:px-16">
        <ScrollReveal className="mx-auto grid max-w-5xl grid-cols-1 gap-10 rounded-2xl border border-border bg-card p-8 sm:grid-cols-3 sm:p-10">
          {[
            {
              icon: ShieldCheck,
              title: "Données isolées",
              description: "Chaque organisation est strictement séparée en base — jamais partagée entre boutiques.",
            },
            {
              icon: WifiOff,
              title: "Zéro caisse bloquée",
              description: "Les ventes se font hors ligne et se synchronisent dès le retour du réseau.",
            },
            {
              icon: Users,
              title: "Équipe à l'écoute",
              description: "Mise en place, formation et support assurés par notre équipe.",
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="flex flex-col items-start gap-2">
                <Icon className="size-5 text-primary" />
                <h3 className="font-semibold text-foreground">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            );
          })}
        </ScrollReveal>
      </section>

      {/* FAQ */}
      <section id="faq" className="px-6 py-20 lg:px-16">
        <div className="mx-auto flex max-w-3xl flex-col gap-10">
          <ScrollReveal className="text-center">
            <p className="text-xs font-semibold tracking-widest text-primary uppercase">FAQ</p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">
              Questions fréquentes
            </h2>
          </ScrollReveal>
          <ScrollReveal delayMs={100} className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-card">
            {FAQ.map((item) => (
              <details key={item.question} className="group px-6 py-5 first:rounded-t-2xl last:rounded-b-2xl">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-foreground marker:content-none">
                  {item.question}
                  <Plus className="size-4 shrink-0 text-primary transition-transform group-open:rotate-45" />
                </summary>
                <p className="mt-3 text-sm text-muted-foreground">{item.answer}</p>
              </details>
            ))}
          </ScrollReveal>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="border-t border-border bg-primary/5 px-6 py-20 lg:px-16">
        <ScrollReveal className="mx-auto grid max-w-5xl grid-cols-1 items-start gap-10 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-xs font-semibold tracking-widest text-primary uppercase">Contact</p>
              <h2 className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">
                Ouvrir votre boutique
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Les comptes sont créés par notre équipe — parlez-nous de votre projet et nous
                revenons vers vous rapidement.
              </p>
            </div>
            <ul className="flex flex-col gap-3">
              {[
                "Mise en place et formation accompagnées",
                "Vos boutiques et votre catalogue configurés pour vous",
                "Support direct avec notre équipe",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-foreground">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Check className="size-3.5" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <ContactForm />
          </div>
        </ScrollReveal>
      </section>

      {/* Pied de page */}
      <footer className="border-t border-border px-6 py-12 lg:px-16">
        <div className="mx-auto flex max-w-6xl flex-col gap-10 sm:flex-row sm:justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- logo statique du produit */}
              <img src="/logo.png" alt="" className="size-7 rounded-md" />
              <span className="font-semibold text-foreground">Tacynt Shop</span>
            </div>
            <p className="max-w-xs text-sm text-muted-foreground">
              La gestion de boutique conçue pour les commerces qui ne peuvent pas se permettre une
              connexion instable.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-10 sm:flex sm:gap-16">
            <div className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-foreground">Produit</span>
              <Link href="#fonctionnalites" className="text-muted-foreground hover:text-foreground">
                Fonctionnalités
              </Link>
              <Link href="#pourquoi" className="text-muted-foreground hover:text-foreground">
                Pourquoi nous
              </Link>
              <Link href="#faq" className="text-muted-foreground hover:text-foreground">
                FAQ
              </Link>
            </div>
            <div className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-foreground">Contact</span>
              <Link href="#contact" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                <Mail className="size-3.5" /> Nous écrire
              </Link>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Phone className="size-3.5" /> Sur demande
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="size-3.5" /> Cameroun
              </span>
            </div>
          </div>
        </div>
        <div className="mx-auto mt-10 max-w-6xl border-t border-border pt-6 text-center text-xs text-subtle-foreground">
          © {new Date().getFullYear()} Tacynt Shop
        </div>
      </footer>
    </div>
  );
}

// Racine "/" (M32) : soit la vitrine e-commerce anonyme d'un hôte tenant
// (aucune session requise — proxy.ts la laisse déjà passer sans vérifier de
// cookie, voir isStorefrontPath), soit la page marketing de Tacynt sur le
// domaine racine. Le mini tableau de bord authentifié qui vivait ici avant
// M32 est remplacé par /dashboard (app/(admin)/dashboard), atteint après
// connexion — plus jamais rendu à cette URL.
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string }>;
}) {
  const context = await getRootPageContext();

  if (context.kind === "not-found") {
    notFound();
  }

  if (context.kind === "marketing") {
    return <MarketingHome />;
  }

  const { organization } = context;
  const { shop: requestedShopId } = await searchParams;
  const shopId = await resolveStorefrontShopId(organization.id, requestedShopId);
  if (!shopId) {
    notFound();
  }

  const items = await withTenantContext({ organizationId: organization.id, shopId }, (tx) =>
    getStorefrontCatalog(tx, shopId),
  );

  const allCategories = Array.from(
    new Set(items.map((item) => item.categoryName).filter((nom): nom is string => nom !== null)),
  ).sort((a, b) => a.localeCompare(b));

  const priceCeiling = items.reduce((max, item) => Math.max(max, item.prixVente), 0) || 1;

  return (
    <StorefrontShell organization={organization}>
      <div className="flex flex-col gap-6">
        <header>
          <h1 className="text-xl font-semibold text-foreground">Catalogue</h1>
          <p className="text-sm text-muted-foreground">
            {items.length} article{items.length > 1 ? "s" : ""} disponible
            {items.length > 1 ? "s" : ""} — paiement à la réception (espèces, Mobile Money, carte).
          </p>
        </header>

        <CatalogueClient
          items={items}
          shopId={shopId}
          devise={organization.devise}
          allCategories={allCategories}
          priceCeiling={priceCeiling}
        />
      </div>
    </StorefrontShell>
  );
}
