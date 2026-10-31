import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { getStorefrontOrganization } from "@/lib/storefront/context";

import { StorefrontShell } from "../storefront-shell";

// Vitrine Location (M38) : même rôle que app/(storefront)/layout.tsx mais
// gardé par le module "location" plutôt que "ecommerce" — un groupe de
// routes séparé plutôt qu'une condition OR dans le layout existant, pour ne
// jamais risquer d'élargir par erreur le gate e-commerce historique.
// /locations reste joignable même pour une organisation qui n'a QUE ce
// module (la racine "/" lui montre alors directement cette vitrine, voir
// app/page.tsx), et reste joignable aussi quand les deux modules sont
// actifs (la racine montre alors le catalogue produit en priorité).
export default async function LocationLayout({ children }: { children: ReactNode }) {
  const organization = await getStorefrontOrganization("location");
  if (!organization) {
    notFound();
  }

  return <StorefrontShell organization={organization}>{children}</StorefrontShell>;
}
