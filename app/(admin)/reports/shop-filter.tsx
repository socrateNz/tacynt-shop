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
    <div className="flex w-fit items-center gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Périmètre">
      <Button
        type="button"
        size="sm"
        variant={consolidated ? "ghost" : "outline"}
        className={consolidated ? "" : "bg-card shadow-card"}
        onClick={() => setConsolidated(false)}
      >
        Cette boutique
      </Button>
      <Button
        type="button"
        size="sm"
        variant={consolidated ? "outline" : "ghost"}
        className={consolidated ? "bg-card shadow-card" : ""}
        onClick={() => setConsolidated(true)}
      >
        Mes boutiques
      </Button>
    </div>
  );
}
