"use client";

import { ChevronDown, ShoppingCart } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";

import { useCart } from "./cart-context";

function CartContents({ devise }: { devise: string }) {
  const { cart, loaded, total, updateQty, setEmballageQty, emballageUnitPrice } = useCart();

  return (
    <>
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
                    {item.quantite} {item.unite} × {formatMoney(item.prixVente, devise)}
                  </span>
                  {item.stockQuantite !== null && (
                    <span className="text-xs text-muted-foreground">
                      Il reste {item.stockQuantite} {item.unite} en stock
                    </span>
                  )}
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
                  <input
                    type="number"
                    min={0}
                    max={item.stockQuantite ?? undefined}
                    value={item.quantite}
                    onChange={(e) => updateQty(cart.shopId, item.variantId, Number(e.target.value))}
                    className="num w-12 rounded-md border border-border bg-background text-center text-foreground"
                    aria-label="Quantité"
                  />
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

          {emballageUnitPrice > 0 && (
            <div className="flex items-center justify-between gap-2 border-t border-border pt-3 text-sm">
              <div className="flex flex-col">
                <span className="text-foreground">Emballage</span>
                <span className="num text-xs text-muted-foreground">
                  {formatMoney(emballageUnitPrice, devise)} / unité
                </span>
              </div>
              <input
                type="number"
                min={0}
                value={cart.emballageQuantite}
                onChange={(e) => setEmballageQty(cart.shopId, Number(e.target.value))}
                className="num w-16 rounded-md border border-border bg-background text-center text-foreground"
                aria-label="Nombre d'emballages"
              />
            </div>
          )}

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
    </>
  );
}

export function CartPanel({ devise }: { devise: string }) {
  return (
    <aside className="hidden h-fit flex-col gap-4 rounded-xl border border-border bg-card p-4 lg:sticky lg:top-6 lg:flex">
      <div className="flex items-center gap-2">
        <ShoppingCart className="size-4 text-foreground" />
        <h2 className="text-sm font-semibold text-foreground">Votre panier</h2>
      </div>
      <CartContents devise={devise} />
    </aside>
  );
}

// Mobile uniquement : sous lg la grille passe en une colonne et le panier
// (dernier élément du DOM) se retrouve après tous les produits — repoussé
// hors écran pendant que le client parcourt le catalogue. Un accordéon
// replié par défaut, affiché avant la grille de produits (voir
// catalogue-client.tsx), garde le nombre d'articles/total visibles sans
// pousser les produits plus bas.
export function MobileCartAccordion({ devise }: { devise: string }) {
  const { cart, loaded, total, count } = useCart();

  return (
    <details className="group rounded-xl border border-border bg-card lg:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 marker:content-none">
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <ShoppingCart className="size-4" />
          Votre panier
          {loaded && count > 0 && (
            <span className="num flex size-5 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
              {count}
            </span>
          )}
        </span>
        <span className="flex items-center gap-2">
          {loaded && cart && cart.items.length > 0 && (
            <span className="num text-sm font-medium text-foreground">
              {formatMoney(total, devise)}
            </span>
          )}
          <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
        </span>
      </summary>
      <div className="flex flex-col gap-4 border-t border-border px-4 py-4">
        <CartContents devise={devise} />
      </div>
    </details>
  );
}
