"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { StorefrontItem } from "@/lib/storefront/catalog";

import { CartPanel } from "./cart-panel";
import { FiltersSidebar, type FiltersState } from "./filters-sidebar";
import { ProductCard } from "./product-card";

export function CatalogueClient({
  items,
  shopId,
  devise,
  allCategories,
  priceCeiling,
}: {
  items: StorefrontItem[];
  shopId: string;
  devise: string;
  allCategories: string[];
  priceCeiling: number;
}) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FiltersState>({
    categories: new Set(),
    minPrice: 0,
    maxPrice: priceCeiling,
    availableOnly: false,
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      if (term && !item.designation.toLowerCase().includes(term)) return false;
      if (
        filters.categories.size > 0 &&
        (!item.categoryName || !filters.categories.has(item.categoryName))
      ) {
        return false;
      }
      if (item.prixVente < filters.minPrice || item.prixVente > filters.maxPrice) return false;
      if (filters.availableOnly && !item.available) return false;
      return true;
    });
  }, [items, search, filters]);

  const activeFilterCount =
    filters.categories.size +
    (filters.minPrice > 0 || filters.maxPrice < priceCeiling ? 1 : 0) +
    (filters.availableOnly ? 1 : 0);

  const filtersPanel = (
    <FiltersSidebar
      allCategories={allCategories}
      priceCeiling={priceCeiling}
      devise={devise}
      filters={filters}
      onChange={setFilters}
    />
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr_300px]">
      {/* Les filtres restent une colonne fixe à partir de lg ; en dessous ils
          passent dans un tiroir, sinon ils repousseraient les produits tout
          en bas de l'écran. */}
      <div className="hidden lg:block">{filtersPanel}</div>

      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un produit..."
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
          {filtered.length} article{filtered.length > 1 ? "s" : ""}
        </p>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {filtered.map((item) => (
            <ProductCard key={item.variantId} item={item} shopId={shopId} devise={devise} />
          ))}
          {filtered.length === 0 && (
            <p className="col-span-2 text-sm text-muted-foreground xl:col-span-4">
              Aucun article ne correspond à ces critères.
            </p>
          )}
        </div>
      </div>

      <CartPanel devise={devise} />
    </div>
  );
}
