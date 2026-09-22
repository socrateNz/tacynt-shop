"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";

// Bascule boutique active / mes boutiques (Phase 3, M20 ; corrigé pour ne
// jamais dépasser les boutiques affectées à l'utilisateur — voir
// lib/tenant/active-shop.ts, getAssignedShopIds). Le composant ne sait pas
// combien de boutiques ça représente, seule la page appelante le sait
// (myShopIds.length) et décide de l'afficher ou non.
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
        Mes boutiques
      </Button>
    </div>
  );
}
