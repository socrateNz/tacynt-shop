"use client";

import type { ReactNode } from "react";

import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";

export type CatalogueTab = { value: string; label: string; content: ReactNode };

// Les catalogues de la vitrine (produits, logements à louer, véhicules à
// louer) sous forme d'onglets sur la même page "/" — jamais des pages
// séparées (M38, étendu au module Location de véhicules). app/page.tsx
// construit la liste des onglets selon les modules actifs et choisit celui
// ouvert par défaut ; le contenu de chaque onglet est déjà rendu par lui.
export function CatalogueTabs({ defaultTab, tabs }: { defaultTab: string; tabs: CatalogueTab[] }) {
  return (
    <Tabs defaultValue={defaultTab} className="flex flex-col gap-6">
      <TabsList className="max-w-full self-start overflow-x-auto">
        {tabs.map((tab) => (
          <TabsTab key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTab>
        ))}
      </TabsList>

      {tabs.map((tab) => (
        <TabsPanel key={tab.value} value={tab.value}>
          {tab.content}
        </TabsPanel>
      ))}
    </Tabs>
  );
}
