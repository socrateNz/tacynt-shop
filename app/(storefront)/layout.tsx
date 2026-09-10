import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getStorefrontOrganization } from "@/lib/storefront/context";
import { parseOrgSettings } from "@/lib/tenant/settings";

// Vitrine e-commerce (Phase 4, M29) : le contrôle vit ici, au niveau du
// layout — toute page sous (storefront) hérite du 404 si l'organisation
// n'est pas résolue ou si le module "ecommerce" n'est pas actif, sans avoir
// à le revérifier dans chaque page.tsx individuellement.
export default async function StorefrontLayout({ children }: { children: ReactNode }) {
  const organization = await getStorefrontOrganization();
  if (!organization) {
    notFound();
  }

  const branding = parseOrgSettings(organization.settings).branding;

  return (
    <div
      className="flex flex-1 flex-col bg-background"
      style={branding?.primaryColor ? ({ "--primary": branding.primaryColor } as CSSProperties) : undefined}
    >
      <header className="flex items-center gap-3 border-b border-border px-6 py-4">
        {branding?.hasLogo ? (
          // eslint-disable-next-line @next/next/no-img-element -- logo servi dynamiquement par organisation, pas un asset statique optimisable par next/image
          <img src="/api/branding/logo" alt={organization.nom} className="h-8 w-auto" />
        ) : (
          <span className="text-lg font-semibold text-foreground">{organization.nom}</span>
        )}
        <span className="text-sm text-muted-foreground">Boutique en ligne</span>
        <Link href="/boutique/panier" className="ml-auto text-sm text-primary underline-offset-4 hover:underline">
          Panier
        </Link>
      </header>
      <main className="flex flex-1 flex-col px-6 py-10">
        <div className="mx-auto w-full max-w-4xl">{children}</div>
      </main>
    </div>
  );
}
