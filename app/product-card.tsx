"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import type { StorefrontItem } from "@/lib/storefront/catalog";

import { useCart } from "./cart-context";

export function ProductCard({
  item,
  shopId,
  devise,
}: {
  item: StorefrontItem;
  shopId: string;
  devise: string;
}) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const attrLabel = Object.values(item.attributs).join(", ");

  function handleAdd() {
    addItem(shopId, {
      variantId: item.variantId,
      designation: item.designation,
      prixVente: item.prixVente,
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1500);
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      {item.hasImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- image binaire servie par la route, pas un asset statique optimisable
        <img
          src={`/api/products/${item.productId}/image`}
          alt={item.designation}
          className="aspect-square w-full rounded-lg border border-border object-cover"
        />
      ) : (
        <div className="aspect-square w-full rounded-lg border border-dashed border-border" />
      )}
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
