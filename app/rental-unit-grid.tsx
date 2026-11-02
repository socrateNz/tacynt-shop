import type { StorefrontRentalUnit } from "@/lib/storefront/rentals";

import { RentalUnitCard } from "./rental-unit-card";

// Partagé entre la racine "/" (module Location seul, voir app/page.tsx) et
// app/rental-catalogue-client.tsx (onglet Logements, filtré) — même grille,
// jamais dupliquée entre les deux points d'entrée.
export function RentalUnitGrid({
  units,
  devise,
  shopId,
}: {
  units: StorefrontRentalUnit[];
  devise: string;
  shopId: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {units.map((u) => (
        <RentalUnitCard key={u.id} unit={u} devise={devise} shopId={shopId} />
      ))}
      {units.length === 0 && (
        <p className="col-span-2 text-sm text-muted-foreground xl:col-span-4">
          Aucun logement ne correspond à ces critères.
        </p>
      )}
    </div>
  );
}
