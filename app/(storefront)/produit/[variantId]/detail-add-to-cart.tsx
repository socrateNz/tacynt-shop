"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

import { useCart } from "../../../cart-context";

export function DetailAddToCart({
  variantId,
  designation,
  unite,
  prixVente,
  stockQuantite,
  prixEmballage,
  productId,
  coverImageId,
  shopId,
  available,
}: {
  variantId: string;
  designation: string;
  unite: string;
  prixVente: number;
  stockQuantite: number | null;
  prixEmballage: number | null;
  productId: string;
  coverImageId: string | null;
  shopId: string;
  available: boolean;
}) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  function handleAdd() {
    addItem(shopId, {
      variantId,
      designation,
      unite,
      prixVente,
      stockQuantite,
      prixEmballage,
      productId,
      coverImageId,
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1500);
  }

  return (
    <Button type="button" disabled={!available} onClick={handleAdd} className="w-full sm:w-auto">
      {added ? "Ajouté au panier" : "Ajouter au panier"}
    </Button>
  );
}
