"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { StorefrontRentalUnit } from "@/lib/storefront/rentals";

import { RentalFiltersSidebar, type RentalFiltersState } from "./rental-filters-sidebar";
import { RentalUnitGrid } from "./rental-unit-grid";

export function RentalCatalogueClient({
  units,
  shopId,
  devise,
  priceCeiling,
  dureeCeiling,
}: {
  units: StorefrontRentalUnit[];
  shopId: string;
  devise: string;
  priceCeiling: number;
  dureeCeiling: number;
}) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<RentalFiltersState>({
    types: new Set(),
    minPrice: 0,
    maxPrice: priceCeiling,
    maxDureeMin: dureeCeiling,
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return units.filter((u) => {
      if (term && !u.designation.toLowerCase().includes(term)) return false;
      if (filters.types.size > 0 && !filters.types.has(u.type)) return false;
      if (u.montantMensuel < filters.minPrice || u.montantMensuel > filters.maxPrice) return false;
      if (u.dureeMinMois > filters.maxDureeMin) return false;
      return true;
    });
  }, [units, search, filters]);

  const activeFilterCount =
    filters.types.size +
    (filters.minPrice > 0 || filters.maxPrice < priceCeiling ? 1 : 0) +
    (filters.maxDureeMin < dureeCeiling ? 1 : 0);

  const filtersPanel = (
    <RentalFiltersSidebar
      priceCeiling={priceCeiling}
      dureeCeiling={dureeCeiling}
      devise={devise}
      filters={filters}
      onChange={setFilters}
    />
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
      <div className="hidden lg:block">{filtersPanel}</div>

      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un logement..."
              className="pl-8"
            />
          </div>
          <Sheet>
            <SheetTrigger render={<Button variant="outline" className="shrink-0 gap-1.5 lg:hidden" />}>
              <SlidersHorizontal className="size-4" />
              Filtres
              {activeFilterCount > 0 && (
                <span className="num flex size-5 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                  {activeFilterCount}
                </span>
              )}
            </SheetTrigger>
            <SheetContent className="overflow-y-auto bg-background p-4 pt-14 text-foreground">
              <SheetTitle className="sr-only">Filtres</SheetTitle>
              {filtersPanel}
            </SheetContent>
          </Sheet>
        </div>

        <p className="text-sm text-muted-foreground">
          {filtered.length} logement{filtered.length > 1 ? "s" : ""}
        </p>

        <RentalUnitGrid units={filtered} devise={devise} shopId={shopId} />
      </div>
    </div>
  );
}
