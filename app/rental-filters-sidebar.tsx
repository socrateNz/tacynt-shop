"use client";

import { Slider } from "@/components/ui/slider";
import { formatMoney } from "@/lib/money";
import { RENTAL_UNIT_TYPES } from "@/lib/rentals/types";

export type RentalFiltersState = {
  types: Set<string>;
  minPrice: number;
  maxPrice: number;
  maxDureeMin: number;
  ville: string | null;
};

// Même patron que filters-sidebar.tsx (catalogue produit) : prix et une
// liste de catégories/types à cocher, plus deux filtres propres aux
// logements (durée minimale souhaitée, ville) sans équivalent côté produit.
export function RentalFiltersSidebar({
  priceCeiling,
  dureeCeiling,
  devise,
  allVilles,
  filters,
  onChange,
}: {
  priceCeiling: number;
  dureeCeiling: number;
  devise: string;
  allVilles: string[];
  filters: RentalFiltersState;
  onChange: (next: RentalFiltersState) => void;
}) {
  function toggleType(value: string) {
    const types = new Set(filters.types);
    if (types.has(value)) types.delete(value);
    else types.add(value);
    onChange({ ...filters, types });
  }

  return (
    <aside className="flex h-fit flex-col gap-6 rounded-xl border border-border bg-card p-4 lg:sticky lg:top-6">
      <h2 className="text-sm font-semibold text-foreground">Filtres</h2>

      <div className="flex flex-col gap-3">
        <p className="text-xs font-medium text-muted-foreground uppercase">Loyer mensuel</p>
        <p className="num text-sm text-foreground">
          {formatMoney(filters.minPrice, devise)} – {formatMoney(filters.maxPrice, devise)}
        </p>
        <Slider
          min={0}
          max={priceCeiling}
          step={Math.max(1, Math.round(priceCeiling / 100))}
          minStepsBetweenValues={0}
          value={[filters.minPrice, filters.maxPrice]}
          onValueChange={(next) => {
            const [minPrice, maxPrice] = next as number[];
            onChange({ ...filters, minPrice, maxPrice });
          }}
        />
      </div>

      {allVilles.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground uppercase">Ville</p>
          <select
            value={filters.ville ?? ""}
            onChange={(e) => onChange({ ...filters, ville: e.target.value || null })}
            className="h-8 rounded-md border border-border bg-background px-2.5 text-sm"
          >
            <option value="">Toutes les villes</option>
            {allVilles.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-muted-foreground uppercase">Type</p>
        <div className="flex flex-col gap-1.5">
          {RENTAL_UNIT_TYPES.map((t) => (
            <label key={t.value} className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={filters.types.has(t.value)}
                onChange={() => toggleType(t.value)}
                className="size-4 accent-primary"
              />
              {t.label}
            </label>
          ))}
        </div>
      </div>

      {dureeCeiling > 1 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium text-muted-foreground uppercase">
            Durée minimale souhaitée
          </p>
          <p className="num text-sm text-foreground">Jusqu&apos;à {filters.maxDureeMin} mois</p>
          <Slider
            min={1}
            max={dureeCeiling}
            step={1}
            value={[filters.maxDureeMin]}
            onValueChange={(next) => onChange({ ...filters, maxDureeMin: (next as number[])[0] })}
          />
        </div>
      )}
    </aside>
  );
}
