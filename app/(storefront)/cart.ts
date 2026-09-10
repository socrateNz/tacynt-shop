// Panier client (Phase 4, M30) : état purement côté navigateur, jamais
// synchronisé au serveur avant la commande — contrairement à la caisse
// hors ligne (IndexedDB + file d'attente), un client de vitrine est supposé
// en ligne, un simple localStorage suffit. Le prix stocké ici n'est
// qu'un affichage : le serveur revalide toujours ShopPrice au moment de la
// commande (décision verrouillée #19), jamais fait confiance tel quel.
export type CartItem = {
  variantId: string;
  designation: string;
  prixVente: number;
  quantite: number;
};

export type Cart = { shopId: string; items: CartItem[] };

const CART_STORAGE_KEY = "tacynt-storefront-cart";

export function getCart(): Cart | null {
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Cart;
  } catch {
    return null;
  }
}

function setCart(cart: Cart): void {
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch {
    // Stockage indisponible (navigation privée, quota) : le panier reste
    // simplement vide pour cette session, jamais une erreur bloquante.
  }
}

export function clearCart(): void {
  try {
    window.localStorage.removeItem(CART_STORAGE_KEY);
  } catch {
    // Rien à faire si le stockage est indisponible.
  }
}

// Un panier ne mélange jamais deux boutiques : passer à une autre boutique
// vide le panier précédent plutôt que d'agréger des prix incohérents.
export function addToCart(shopId: string, item: Omit<CartItem, "quantite">, quantite = 1): Cart {
  const current = getCart();
  const base: Cart = current && current.shopId === shopId ? current : { shopId, items: [] };

  const existing = base.items.find((i) => i.variantId === item.variantId);
  const items = existing
    ? base.items.map((i) =>
        i.variantId === item.variantId ? { ...i, quantite: i.quantite + quantite } : i,
      )
    : [...base.items, { ...item, quantite }];

  const next: Cart = { shopId, items };
  setCart(next);
  return next;
}

export function updateQuantity(shopId: string, variantId: string, quantite: number): Cart {
  const current = getCart() ?? { shopId, items: [] };
  const items =
    quantite <= 0
      ? current.items.filter((i) => i.variantId !== variantId)
      : current.items.map((i) => (i.variantId === variantId ? { ...i, quantite } : i));
  const next: Cart = { shopId, items };
  setCart(next);
  return next;
}

export function cartTotal(cart: Cart | null): number {
  if (!cart) return 0;
  return cart.items.reduce((sum, i) => sum + i.prixVente * i.quantite, 0);
}

export function cartCount(cart: Cart | null): number {
  if (!cart) return 0;
  return cart.items.reduce((sum, i) => sum + i.quantite, 0);
}
