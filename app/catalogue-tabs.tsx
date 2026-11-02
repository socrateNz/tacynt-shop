"use client";

import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import type { StorefrontItem } from "@/lib/storefront/catalog";
import type { StorefrontRentalUnit } from "@/lib/storefront/rentals";

import { CatalogueClient } from "./catalogue-client";
import { RentalUnitGrid } from "./rental-unit-grid";

// Catalogue produit + logements à louer sous forme de deux onglets (M38),
// jamais deux pages séparées — une seule page "/" quand les deux modules
// sont actifs. defaultTab porte la règle de priorité décidée avec
// l'utilisateur : Produits par défaut, sauf si le catalogue produit est
// vide, où Logements prend la priorité (app/page.tsx calcule laquelle).
export function CatalogueTabs({
  defaultTab,
  items,
  units,
  shopId,
  devise,
  allCategories,
  priceCeiling,
}: {
  defaultTab: "produits" | "logements";
  items: StorefrontItem[];
  units: StorefrontRentalUnit[];
  shopId: string;
  devise: string;
  allCategories: string[];
  priceCeiling: number;
}) {
  return (
    <Tabs defaultValue={defaultTab} className="flex flex-col gap-6">
      <TabsList className="self-start">
        <TabsTab value="produits">Produits</TabsTab>
        <TabsTab value="logements">Logements</TabsTab>
      </TabsList>

      <TabsPanel value="produits">
        <CatalogueClient
          items={items}
          shopId={shopId}
          devise={devise}
          allCategories={allCategories}
          priceCeiling={priceCeiling}
        />
      </TabsPanel>

      <TabsPanel value="logements">
        <div className="flex flex-col gap-6">
          <p className="text-sm text-muted-foreground">
            {units.length} logement{units.length > 1 ? "s" : ""} disponible
            {units.length > 1 ? "s" : ""}.
          </p>
          <RentalUnitGrid units={units} devise={devise} shopId={shopId} />
        </div>
      </TabsPanel>
    </Tabs>
  );
}
