"use client";

import { ShoppingCart } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";

import { useCart } from "./cart-context";

export function CartPanel({ devise }: { devise: string }) {
  const { cart, loaded, total, updateQty } = useCart();

  return (
    <aside className="flex h-fit flex-col gap-4 rounded-xl border border-border bg-card p-4 lg:sticky lg:top-6">
      <div className="flex items-center gap-2">
        <ShoppingCart className="size-4 text-foreground" />
        <h2 className="text-sm font-semibold text-foreground">Votre panier</h2>
      </div>

      {!loaded ? null : !cart || cart.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun article ajouté pour l&apos;instant.</p>
      ) : (
        <>
          <div className="flex max-h-80 flex-col gap-3 overflow-y-auto">
            {cart.items.map((item) => (
              <div key={item.variantId} className="flex items-start justify-between gap-2 text-sm">
                <div className="flex flex-col">
                  <span className="text-foreground">{item.designation}</span>
                  <span className="num text-xs text-muted-foreground">
                    {item.quantite} × {formatMoney(item.prixVente, devise)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => updateQty(cart.shopId, item.variantId, item.quantite - 1)}
                    className="flex size-6 items-center justify-center rounded-md border border-border text-foreground hover:bg-muted"
                    aria-label="Diminuer la quantité"
                  >
                    −
                  </button>
                  <span className="num w-5 text-center text-foreground">{item.quantite}</span>
                  <button
                    type="button"
                    onClick={() => updateQty(cart.shopId, item.variantId, item.quantite + 1)}
                    className="flex size-6 items-center justify-center rounded-md border border-border text-foreground hover:bg-muted"
                    aria-label="Augmenter la quantité"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-border pt-3">
            <span className="text-sm font-medium text-foreground">Total</span>
            <span className="num text-lg font-semibold text-foreground">
              {formatMoney(total, devise)}
            </span>
          </div>

          <Link href="/commande">
            <Button type="button" className="w-full">
              Passer la commande
            </Button>
          </Link>
        </>
      )}
    </aside>
  );
}
