"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";

import { addToCart } from "../cart";
import type { StorefrontItem } from "@/lib/storefront/catalog";

export function ProductCard({
  item,
  shopId,
  devise,
}: {
  item: StorefrontItem;
  shopId: string;
  devise: string;
}) {
  const [added, setAdded] = useState(false);
  const attrLabel = Object.values(item.attributs).join(", ");

  function handleAdd() {
    addToCart(shopId, {
      variantId: item.variantId,
      designation: item.designation,
      prixVente: item.prixVente,
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1500);
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-medium text-foreground">
        {item.designation}
        {attrLabel ? ` — ${attrLabel}` : ""}
      </p>
      <p className="num text-lg font-semibold text-foreground">{formatMoney(item.prixVente, devise)}</p>
      <span className={item.available ? "text-xs text-primary" : "text-xs text-muted-foreground"}>
        {item.available ? "En stock" : "Indisponible"}
      </span>
      <Button type="button" size="sm" disabled={!item.available} onClick={handleAdd}>
        {added ? "Ajouté" : "Ajouter au panier"}
      </Button>
    </div>
  );
}
