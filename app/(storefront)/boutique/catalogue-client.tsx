"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
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

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr_300px]">
      <FiltersSidebar
        allCategories={allCategories}
        priceCeiling={priceCeiling}
        devise={devise}
        filters={filters}
        onChange={setFilters}
      />

      <div className="flex flex-col gap-4">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un produit..."
            className="pl-8"
          />
        </div>

        <p className="text-sm text-muted-foreground">
          {filtered.length} article{filtered.length > 1 ? "s" : ""}
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {filtered.map((item) => (
            <ProductCard key={item.variantId} item={item} shopId={shopId} devise={devise} />
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground sm:col-span-2 xl:col-span-4">
              Aucun article ne correspond à ces critères.
            </p>
          )}
        </div>
      </div>

      <CartPanel devise={devise} />
    </div>
  );
}
