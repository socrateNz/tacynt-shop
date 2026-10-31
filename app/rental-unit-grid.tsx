import Link from "next/link";

import { formatMoney } from "@/lib/money";
import type { StorefrontRentalUnit } from "@/lib/storefront/rentals";

const RENTAL_TYPE_LABELS: Record<string, string> = {
  CHAMBRE: "Chambre",
  STUDIO: "Studio",
  APPARTEMENT: "Appartement",
  VILLA: "Villa",
  AUTRE: "Logement",
};

// Partagé entre la racine "/" (quand seul le module Location est actif,
// voir app/page.tsx) et app/(location)/locations/page.tsx (toujours
// joignable, y compris quand les deux modules sont actifs) — même grille,
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
        <Link
          key={u.id}
          href={`/locations/${u.id}?shop=${shopId}`}
          className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 hover:border-primary/40"
        >
          {u.coverImageId ? (
            // eslint-disable-next-line @next/next/no-img-element -- image binaire servie par la route, pas un asset statique optimisable
            <img
              src={`/api/rentals/units/${u.id}/images/${u.coverImageId}`}
              alt=""
              className="aspect-square w-full rounded-md object-cover"
            />
          ) : (
            <div className="aspect-square w-full rounded-md border border-dashed border-border" />
          )}
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">
              {RENTAL_TYPE_LABELS[u.type] ?? u.type}
            </span>
            <span className="text-sm font-medium text-foreground">{u.designation}</span>
            <span className="num text-sm text-foreground">
              {formatMoney(u.montantMensuel, devise)} / mois
            </span>
            <span className="text-xs text-muted-foreground">Min. {u.dureeMinMois} mois</span>
          </div>
        </Link>
      ))}
      {units.length === 0 && (
        <p className="col-span-2 text-sm text-muted-foreground xl:col-span-4">
          Aucun logement disponible pour l&apos;instant.
        </p>
      )}
    </div>
  );
}
