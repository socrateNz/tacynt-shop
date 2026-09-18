import type { CSSProperties, ReactNode } from "react";
import type { Organization } from "@prisma/client";

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

  return (
    <div
      className="flex flex-1 flex-col bg-background"
      style={branding?.primaryColor ? ({ "--primary": branding.primaryColor } as CSSProperties) : undefined}
    >
      <CartProvider>
        <header className="flex items-center gap-3 border-b border-border px-6 py-4">
          {branding?.hasLogo ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo servi dynamiquement par organisation, pas un asset statique optimisable par next/image
            <img src="/api/branding/logo" alt={organization.nom} className="h-8 w-auto" />
          ) : (
            <span className="text-lg font-semibold text-foreground">{organization.nom}</span>
          )}
          <span className="text-sm text-muted-foreground">Boutique en ligne</span>
          <CartHeaderLink />
        </header>
        <main className="flex flex-1 flex-col px-6 py-10">{children}</main>
      </CartProvider>
    </div>
  );
}
