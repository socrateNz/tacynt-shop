"use client";

import { MapPin } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { formatMoney } from "@/lib/money";
import { RENTAL_UNIT_AMENITY_LABELS, RENTAL_UNIT_TYPE_LABELS } from "@/lib/rentals/types";
import type { StorefrontRentalUnit } from "@/lib/storefront/rentals";
import { cn } from "@/lib/utils";

const AMENITY_PREVIEW_COUNT = 3;

// Carte inspirée des annonces de location type plateforme immobilière
// (référence fournie par l'utilisateur) : mini-carrousel à points, badge de
// type, localisation, surface/pièces, aperçu équipements, prix mis en
// avant, statut de disponibilité. "Disponible immédiatement" est toujours
// vrai ici : la liste qui alimente cette carte exclut déjà les logements
// occupés (voir getStorefrontRentalUnits).
export function RentalUnitCard({
  unit,
  devise,
  shopId,
}: {
  unit: StorefrontRentalUnit;
  devise: string;
  shopId: string;
}) {
  const [activeImage, setActiveImage] = useState(0);
  const href = `/locations/${unit.id}?shop=${shopId}`;
  const typeLabel = RENTAL_UNIT_TYPE_LABELS[unit.type] ?? unit.type;
  const visibleAmenities = unit.equipements.slice(0, AMENITY_PREVIEW_COUNT);
  const extraAmenitiesCount = unit.equipements.length - visibleAmenities.length;

  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/40 sm:p-4">
      <div className="relative">
        <Link href={href} className="block">
          {unit.imageIds.length > 0 ? (
            // eslint-disable-next-line @next/next/no-img-element -- image binaire servie par la route, pas un asset statique optimisable
            <img
              src={`/api/rentals/units/${unit.id}/images/${unit.imageIds[activeImage]}`}
              alt={unit.designation}
              className="aspect-4/3 w-full rounded-lg border border-border object-cover"
            />
          ) : (
            <div className="aspect-4/3 w-full rounded-lg border border-dashed border-border" />
          )}
        </Link>

        <span className="absolute top-2 left-2 rounded-full bg-background/90 px-2 py-0.5 text-xs font-medium text-foreground shadow-sm backdrop-blur-sm">
          {typeLabel}
        </span>

        {unit.imageIds.length > 1 && (
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
            {unit.imageIds.map((id, i) => (
              <button
                key={id}
                type="button"
                aria-label={`Photo ${i + 1}`}
                onMouseEnter={() => setActiveImage(i)}
                onClick={(e) => {
                  e.preventDefault();
                  setActiveImage(i);
                }}
                className={cn(
                  "size-1.5 rounded-full transition-colors",
                  i === activeImage ? "bg-white" : "bg-white/50",
                )}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex items-start justify-between gap-2">
        <Link
          href={href}
          className="min-w-0 text-sm font-medium break-words text-foreground hover:underline"
        >
          {unit.designation}
        </Link>
        <div className="shrink-0 text-right">
          <p className="num text-sm font-semibold text-foreground">
            {formatMoney(unit.montantMensuel, devise)}
          </p>
          <p className="text-xs text-muted-foreground">/ mois</p>
        </div>
      </div>

      {unit.locality && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="size-3 shrink-0" />
          {unit.locality.villeNom ? `${unit.locality.nom}, ${unit.locality.villeNom}` : unit.locality.nom}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
          Min. {unit.dureeMinMois} mois
        </span>
        {unit.surfaceM2 !== null && (
          <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
            {unit.surfaceM2} m²
          </span>
        )}
        {unit.nombrePieces !== null && (
          <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
            {unit.nombrePieces} pièce{unit.nombrePieces > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {unit.equipements.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {visibleAmenities.map((a) => (
            <span key={a} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {RENTAL_UNIT_AMENITY_LABELS[a] ?? a}
            </span>
          ))}
          {extraAmenitiesCount > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              +{extraAmenitiesCount}
            </span>
          )}
        </div>
      )}

      {unit.description && (
        <p className="line-clamp-2 text-xs text-muted-foreground">{unit.description}</p>
      )}

      <div className="mt-auto flex items-center gap-1.5 pt-1">
        <span className="size-1.5 shrink-0 rounded-full bg-success" />
        <span className="text-xs text-muted-foreground">Disponible immédiatement</span>
      </div>
    </div>
  );
}
