import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { Organization } from "@prisma/client";

import { organizationHasModule } from "@/lib/tenant/modules";
import { parseOrgSettings } from "@/lib/tenant/settings";

import { CartHeaderLink } from "./cart-header-link";
import { CartProvider } from "./cart-context";

// Habillage visuel partagé de la vitrine e-commerce (Phase 4, M29/M32) :
// logo/couleur white-label, CartProvider, lien panier — repris à la fois par
// la racine "/" (app/page.tsx, catalogue) et par les pages restantes sous
// app/(storefront)/ (panier, commande, merci). La résolution d'organisation
// et le notFound() associé restent à la charge de chaque appelant (jamais
// refaits ici) : voir app/page.tsx et app/(storefront)/layout.tsx.
export function StorefrontShell({
  organization,
  children,
}: {
  organization: Organization;
  children: ReactNode;
}) {
  const branding = parseOrgSettings(organization.settings).branding;
  // Le panier n'a de sens que si le module E-commerce est actif — une
  // organisation qui n'a que le module Location n'a pas de catalogue
  // produit à vendre. Quand les deux modules sont actifs, les logements
  // vivent dans l'onglet "Logements" de la racine "/" (voir
  // app/catalogue-tabs.tsx) — pas de lien séparé à afficher ici.
  const ecommerceEnabled = organizationHasModule(organization.enabledModules, "ecommerce");

  return (
    <div
      className="flex flex-1 flex-col bg-background"
      style={branding?.primaryColor ? ({ "--primary": branding.primaryColor } as CSSProperties) : undefined}
    >
      <CartProvider>
        <header className="flex items-center gap-3 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
          {branding?.hasLogo ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo servi dynamiquement par organisation, pas un asset statique optimisable par next/image
            <img src="/api/branding/logo" alt={organization.nom} className="h-8 w-auto shrink-0" />
          ) : (
            <span className="truncate text-lg font-semibold text-foreground">{organization.nom}</span>
          )}
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {ecommerceEnabled ? "Boutique en ligne" : "Location"}
          </span>
          <div className="ml-auto flex items-center gap-3">
            {/* Discret à dessein : utile au propriétaire/personnel de la
                boutique pour rejoindre leur tableau de bord, pas une
                invitation destinée aux clients qui naviguent la vitrine. */}
            <Link
              href="/login"
              className="shrink-0 text-sm text-muted-foreground hover:text-foreground hover:underline"
            >
              Se connecter
            </Link>
            {ecommerceEnabled && <CartHeaderLink />}
          </div>
        </header>
        <main className="flex flex-1 flex-col px-4 py-6 sm:px-6 sm:py-10">{children}</main>
      </CartProvider>
    </div>
  );
}
