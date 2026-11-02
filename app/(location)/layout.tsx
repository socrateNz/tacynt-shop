import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { getStorefrontOrganization } from "@/lib/storefront/context";

import { StorefrontShell } from "../storefront-shell";

// Vitrine Location (M38) : même rôle que app/(storefront)/layout.tsx mais
// gardé par le module "location" plutôt que "ecommerce" — un groupe de
// routes séparé plutôt qu'une condition OR dans le layout existant, pour ne
// jamais risquer d'élargir par erreur le gate e-commerce historique. Ne
// couvre plus que la fiche détail (/locations/[unitId]) et la confirmation
// (/locations/merci/[contractId]) — la LISTE des logements n'a plus de page
// dédiée, elle vit dans l'onglet "Logements" de la racine "/" quand les deux
// modules sont actifs, ou directement à la racine si seul "location" l'est
// (voir app/page.tsx et app/catalogue-tabs.tsx).
export default async function LocationLayout({ children }: { children: ReactNode }) {
  const organization = await getStorefrontOrganization("location");
  if (!organization) {
    notFound();
  }

  return <StorefrontShell organization={organization}>{children}</StorefrontShell>;
}
