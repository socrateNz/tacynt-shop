"use client";

import { Slider } from "@/components/ui/slider";
import { formatMoney } from "@/lib/money";

export type FiltersState = {
  categories: Set<string>;
  minPrice: number;
  maxPrice: number;
  availableOnly: boolean;
};

export function FiltersSidebar({
  allCategories,
  priceCeiling,
  devise,
  filters,
  onChange,
}: {
  allCategories: string[];
  priceCeiling: number;
  devise: string;
  filters: FiltersState;
  onChange: (next: FiltersState) => void;
}) {
  function toggleCategory(nom: string) {
    const categories = new Set(filters.categories);
    if (categories.has(nom)) categories.delete(nom);
    else categories.add(nom);
    onChange({ ...filters, categories });
  }

  return (
    <aside className="flex h-fit flex-col gap-6 rounded-xl border border-border bg-card p-4 lg:sticky lg:top-6">
      <h2 className="text-sm font-semibold text-foreground">Filtres</h2>

      <div className="flex flex-col gap-3">
        <p className="text-xs font-medium text-muted-foreground uppercase">Tranche de prix</p>
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

      {allCategories.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground uppercase">Catégorie</p>
          <div className="flex flex-col gap-1.5">
            {allCategories.map((nom) => (
              <label key={nom} className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={filters.categories.has(nom)}
                  onChange={() => toggleCategory(nom)}
                  className="size-4 accent-primary"
                />
                {nom}
              </label>
            ))}
          </div>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={filters.availableOnly}
          onChange={(e) => onChange({ ...filters, availableOnly: e.target.checked })}
          className="size-4 accent-primary"
        />
        Produits disponibles uniquement
      </label>
    </aside>
  );
}
