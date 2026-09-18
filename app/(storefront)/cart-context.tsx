"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import {
  addToCart as addToCartStorage,
  cartCount,
  cartTotal,
  clearCart as clearCartStorage,
  getCart,
  updateQuantity as updateQuantityStorage,
  type Cart,
  type CartItem,
} from "./cart";

type CartContextValue = {
  cart: Cart | null;
  loaded: boolean;
  total: number;
  count: number;
  addItem: (shopId: string, item: Omit<CartItem, "quantite">, quantite?: number) => void;
  updateQty: (shopId: string, variantId: string, quantite: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

// Un seul état de panier partagé (Contexte React) plutôt que chaque
// composant relisant localStorage indépendamment (ancien patron) : le
// header (compteur), la page catalogue (panneau panier permanent) et la
// page panier doivent tous refléter un ajout immédiatement, sans recharger
// la page — un événement "storage" ne se déclenche jamais dans l'onglet qui
// a lui-même écrit, donc inutilisable ici.
export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // localStorage n'existe pas côté serveur — lu uniquement après montage,
    // dans un callback (même pattern que pos-client.tsx) plutôt qu'en
    // synchrone dans le corps de l'effet.
    (async () => {
      setCart(getCart());
      setLoaded(true);
    })();
  }, []);

  function addItem(shopId: string, item: Omit<CartItem, "quantite">, quantite = 1) {
    setCart(addToCartStorage(shopId, item, quantite));
  }

  function updateQty(shopId: string, variantId: string, quantite: number) {
    setCart(updateQuantityStorage(shopId, variantId, quantite));
  }

  function clear() {
    clearCartStorage();
    setCart(null);
  }

  return (
    <CartContext.Provider
      value={{ cart, loaded, total: cartTotal(cart), count: cartCount(cart), addItem, updateQty, clear }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart doit être utilisé sous CartProvider.");
  return ctx;
}
