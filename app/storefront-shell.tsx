import { MapPin, Phone } from "lucide-react";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { Organization } from "@prisma/client";

import { systemPrisma } from "@/lib/db/system-client";
import { resolveStorefrontShopId } from "@/lib/storefront/context";
import { organizationHasModule } from "@/lib/tenant/modules";
import { parseOrgSettings } from "@/lib/tenant/settings";

import { CartHeaderLink } from "./cart-header-link";
import { CartProvider } from "./cart-context";

// Habillage visuel partagé de la vitrine e-commerce + Location (Phase 4,
// M29/M32/M38 ; refonte "vrai site" M40) : logo/couleur white-label,
// CartProvider, en-tête collant + pied de page — repris par la racine "/"
// (app/page.tsx, catalogue) et par toutes les pages sous app/(storefront)/
// et app/(location)/. La résolution d'organisation et le notFound() associé
// restent à la charge de chaque appelant (jamais refaits ici) : voir
// app/page.tsx, app/(storefront)/layout.tsx, app/(location)/layout.tsx.
export async function StorefrontShell({
  organization,
  children,
}: {
  organization: Organization;
  children: ReactNode;
}) {
  const branding = parseOrgSettings(organization.settings).branding;
  const ecommerceEnabled = organizationHasModule(organization.enabledModules, "ecommerce");
  const locationEnabled = organizationHasModule(organization.enabledModules, "location");
  const tagline =
    ecommerceEnabled && locationEnabled
      ? "Boutique en ligne & Location"
      : locationEnabled
        ? "Location"
        : "Boutique en ligne";

  // Boutique par défaut de l'organisation (même résolution que le
  // catalogue quand aucune ?shop= n'est précisée) — seulement pour afficher
  // ses coordonnées en pied de page si elles sont renseignées, jamais une
  // donnée inventée. Les layouts (storefront)/(location) n'ont pas accès à
  // searchParams (seules les pages en ont), donc on ne peut pas refléter
  // ici la boutique exacte que visite un client multi-boutique — ce
  // fallback reste honnête (vraie boutique de l'organisation) même s'il
  // n'est pas toujours celle affichée dans le catalogue au même instant.
  const defaultShopId = await resolveStorefrontShopId(organization.id);
  const shop = defaultShopId
    ? await systemPrisma.shop.findUnique({
        where: { id: defaultShopId },
        select: { adresse: true, telephone: true },
      })
    : null;

  return (
    <div
      className="flex flex-1 flex-col bg-background"
      style={branding?.primaryColor ? ({ "--primary": branding.primaryColor } as CSSProperties) : undefined}
    >
      <CartProvider>
        <header className="sticky top-0 z-30 border-b border-border bg-card/80 px-4 py-3 backdrop-blur-md sm:px-6">
          <div className="mx-auto flex w-full max-w-[1920px] items-center gap-3">
            <Link href="/" className="flex min-w-0 items-center gap-2">
              {branding?.hasLogo ? (
                // eslint-disable-next-line @next/next/no-img-element -- logo servi dynamiquement par organisation, pas un asset statique optimisable par next/image
                <img src="/api/branding/logo" alt={organization.nom} className="h-8 w-auto shrink-0" />
              ) : (
                <span className="truncate text-lg font-semibold text-foreground">{organization.nom}</span>
              )}
              <span className="hidden truncate text-sm text-muted-foreground sm:inline">{tagline}</span>
            </Link>
            <div className="ml-auto flex items-center gap-3">
              {/* Discret à dessein : utile au propriétaire/personnel de la
                  boutique pour rejoindre leur tableau de bord, pas une
                  invitation destinée aux clients qui naviguent la vitrine. */}
              <Link
                href="/login"
                className="shrink-0 text-sm text-muted-foreground transition-colors hover:text-foreground hover:underline"
              >
                Se connecter
              </Link>
              {ecommerceEnabled && <CartHeaderLink />}
            </div>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-[1920px] flex-1 flex-col px-4 py-6 sm:px-6 sm:py-10">
          {children}
        </main>

        <footer className="border-t border-border px-4 py-10 sm:px-6">
          <div className="mx-auto flex w-full max-w-[1920px] flex-col gap-8 sm:flex-row sm:justify-between">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                {branding?.hasLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- logo servi dynamiquement par organisation
                  <img src="/api/branding/logo" alt={organization.nom} className="h-7 w-auto" />
                ) : (
                  <span className="font-semibold text-foreground">{organization.nom}</span>
                )}
              </div>
              <p className="max-w-xs text-sm text-muted-foreground">{tagline}</p>
              {ecommerceEnabled && (
                <p className="text-xs text-muted-foreground">
                  Paiement à la réception (espèces, Mobile Money, carte), sauf mention contraire au
                  moment de la commande.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-10 sm:flex sm:gap-16">
              <div className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-foreground">Navigation</span>
                <Link href="/" className="text-muted-foreground hover:text-foreground">
                  Accueil
                </Link>
                {ecommerceEnabled && (
                  <Link href="/panier" className="text-muted-foreground hover:text-foreground">
                    Mon panier
                  </Link>
                )}
              </div>

              {(shop?.adresse || shop?.telephone) && (
                <div className="flex flex-col gap-2 text-sm">
                  <span className="font-medium text-foreground">Contact</span>
                  {shop.telephone && (
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Phone className="size-3.5 shrink-0" /> {shop.telephone}
                    </span>
                  )}
                  {shop.adresse && (
                    <span className="flex items-start gap-1.5 text-muted-foreground">
                      <MapPin className="size-3.5 shrink-0 translate-y-0.5" /> {shop.adresse}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="mx-auto mt-8 flex w-full max-w-[1920px] flex-col gap-2 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>
              © {new Date().getFullYear()} {organization.nom}
            </span>
          </div>
        </footer>
      </CartProvider>
    </div>
  );
}
