"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";

// Bascule simple boutique active / toute l'organisation (Phase 3, M20) — la
// policy RLS existante gère déjà le cas consolidé (app.shop_id non
// positionné = toutes les boutiques de l'organisation), aucun changement
// de schéma nécessaire, seulement ce paramètre côté page.
export function ShopFilter({ consolidated }: { consolidated: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setConsolidated(next: boolean) {
    const params = new URLSearchParams(searchParams.toString());
    if (next) {
      params.set("shop", "all");
    } else {
      params.delete("shop");
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
      <Button
        type="button"
        size="sm"
        variant={consolidated ? "ghost" : "outline"}
        onClick={() => setConsolidated(false)}
      >
        Cette boutique
      </Button>
      <Button
        type="button"
        size="sm"
        variant={consolidated ? "outline" : "ghost"}
        onClick={() => setConsolidated(true)}
      >
        Toute l&apos;organisation
      </Button>
    </div>
  );
}
