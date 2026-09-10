"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/money";

import { cartTotal, getCart, updateQuantity, type Cart } from "../cart";

export function CartView({ devise }: { devise: string }) {
  const [cart, setCartState] = useState<Cart | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // localStorage n'existe pas côté serveur — lu uniquement après montage,
    // dans un callback (même pattern que pos-client.tsx) plutôt qu'en
    // synchrone dans le corps de l'effet.
    (async () => {
      setCartState(getCart());
      setLoaded(true);
    })();
  }, []);

  function handleQuantityChange(variantId: string, quantite: number) {
    if (!cart) return;
    setCartState(updateQuantity(cart.shopId, variantId, quantite));
  }

  if (!loaded) return null;

  if (!cart || cart.items.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">Votre panier est vide.</p>
        <Link href="/boutique" className="text-sm text-primary underline-offset-4 hover:underline">
          ← Retour au catalogue
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {cart.items.map((item) => (
        <div
          key={item.variantId}
          className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4"
        >
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-foreground">{item.designation}</p>
            <p className="num text-sm text-muted-foreground">{formatMoney(item.prixVente, devise)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              value={item.quantite}
              onChange={(e) => handleQuantityChange(item.variantId, Number(e.target.value))}
              className="w-20"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleQuantityChange(item.variantId, 0)}
            >
              Retirer
            </Button>
          </div>
        </div>
      ))}

      <div className="flex items-center justify-between border-t border-border pt-4">
        <p className="num text-lg font-semibold text-foreground">
          Total : {formatMoney(cartTotal(cart), devise)}
        </p>
        <Link href="/boutique/commande">
          <Button type="button">Passer la commande</Button>
        </Link>
      </div>
    </div>
  );
}
