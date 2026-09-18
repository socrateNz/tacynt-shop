import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { getStorefrontOrganization } from "@/lib/storefront/context";

import { StorefrontShell } from "../storefront-shell";

// Vitrine e-commerce (Phase 4, M29) : le contrôle vit ici, au niveau du
// layout — toute page sous (storefront) hérite du 404 si l'organisation
// n'est pas résolue ou si le module "ecommerce" n'est pas actif, sans avoir
// à le revérifier dans chaque page.tsx individuellement. Ne wrappe plus que
// /panier, /commande, /merci/[orderId] depuis M32 — la racine "/" (le
// catalogue) est gérée directement par app/page.tsx, qui applique le même
// StorefrontShell lui-même (voir son propre commentaire).
export default async function StorefrontLayout({ children }: { children: ReactNode }) {
  const organization = await getStorefrontOrganization();
  if (!organization) {
    notFound();
  }

  return <StorefrontShell organization={organization}>{children}</StorefrontShell>;
}
