import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { getStorefrontOrganization } from "@/lib/storefront/context";

import { StorefrontShell } from "../storefront-shell";

// Vitrine Location de véhicules : fiche (/vehicules/[vehicleId]) et
// confirmation (/vehicules/merci/[bookingId]), gardées par le module
// "location_vehicules" — même principe que le groupe (location) pour les
// logements. La LISTE vit dans l'onglet "Véhicules" de la racine "/".
export default async function VehiclesStorefrontLayout({ children }: { children: ReactNode }) {
  const organization = await getStorefrontOrganization("location_vehicules");
  if (!organization) {
    notFound();
  }

  return <StorefrontShell organization={organization}>{children}</StorefrontShell>;
}
