// Panier client (Phase 4, M30) : état purement côté navigateur, jamais
// synchronisé au serveur avant la commande — contrairement à la caisse
// hors ligne (IndexedDB + file d'attente), un client de vitrine est supposé
// en ligne, un simple localStorage suffit. Le prix stocké ici n'est
// qu'un affichage : le serveur revalide toujours ShopPrice au moment de la
// commande (décision verrouillée #19), jamais fait confiance tel quel.
export type CartItem = {
  variantId: string;
  designation: string;
  unite: string;
  prixVente: number;
  quantite: number;
  // Photo prise à l'ajout, même principe que prixVente ci-dessus : un
  // plafond de saisie/affichage côté client, jamais l'autorité finale (voir
  // POST /api/storefront/orders, qui revalide toujours le stock réel).
  // null = pas de limite.
  stockQuantite: number | null;
  // Photo du prix d'emballage du produit (M35), null si non proposé — voir
  // emballageUnitPrice ci-dessous pour comment plusieurs articles se
  // combinent en un seul prix d'emballage pour tout le panier.
  prixEmballage: number | null;
};

// emballageQuantite : nombre d'emballages choisi librement par le client,
// indépendant du nombre d'articles (un emballage peut en contenir
// plusieurs) — jamais une case à cocher par article.
export type Cart = { shopId: string; items: CartItem[]; emballageQuantite: number };

const CART_STORAGE_KEY = "tacynt-storefront-cart";

export function getCart(): Cart | null {
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Cart;
    // Un panier écrit avant l'ajout d'emballageQuantite (M35) n'a pas ce
    // champ — défaut à 0 plutôt qu'undefined.
    return { ...parsed, emballageQuantite: parsed.emballageQuantite ?? 0 };
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

// Simple plafond de saisie — jamais l'autorité finale, voir le commentaire
// sur CartItem.stockQuantite ci-dessus.
function clampToStock(quantite: number, stockQuantite: number | null): number {
  if (stockQuantite === null) return quantite;
  return Math.min(quantite, stockQuantite);
}

// Un panier ne mélange jamais deux boutiques : passer à une autre boutique
// vide le panier précédent plutôt que d'agréger des prix incohérents.
export function addToCart(shopId: string, item: Omit<CartItem, "quantite">, quantite = 1): Cart {
  const current = getCart();
  const base: Cart =
    current && current.shopId === shopId ? current : { shopId, items: [], emballageQuantite: 0 };

  const existing = base.items.find((i) => i.variantId === item.variantId);
  const items = existing
    ? base.items.map((i) =>
        i.variantId === item.variantId
          ? { ...i, quantite: clampToStock(i.quantite + quantite, i.stockQuantite) }
          : i,
      )
    : [...base.items, { ...item, quantite: clampToStock(quantite, item.stockQuantite) }];

  const next: Cart = { ...base, shopId, items };
  setCart(next);
  return next;
}

export function updateQuantity(shopId: string, variantId: string, quantite: number): Cart {
  const current = getCart() ?? { shopId, items: [], emballageQuantite: 0 };
  const items =
    quantite <= 0
      ? current.items.filter((i) => i.variantId !== variantId)
      : current.items.map((i) =>
          i.variantId === variantId ? { ...i, quantite: clampToStock(quantite, i.stockQuantite) } : i,
        );
  const next: Cart = { ...current, shopId, items };
  setCart(next);
  return next;
}

export function setEmballageQty(shopId: string, emballageQuantite: number): Cart {
  const current = getCart() ?? { shopId, items: [], emballageQuantite: 0 };
  const next: Cart = { ...current, shopId, emballageQuantite: Math.max(0, emballageQuantite) };
  setCart(next);
  return next;
}

// Prix unitaire retenu pour tout le panier : le plus élevé parmi les
// prixEmballage des articles présents — garantit que le prix couvre le
// besoin le plus coûteux du panier, pas une moyenne qui sous-facturerait un
// article fragile. 0 si aucun article du panier n'a de prix d'emballage.
export function emballageUnitPrice(cart: Cart | null): number {
  if (!cart) return 0;
  return cart.items.reduce((max, i) => Math.max(max, i.prixEmballage ?? 0), 0);
}

export function cartTotal(cart: Cart | null): number {
  if (!cart) return 0;
  const itemsTotal = cart.items.reduce((sum, i) => sum + i.prixVente * i.quantite, 0);
  return itemsTotal + cart.emballageQuantite * emballageUnitPrice(cart);
}

export function cartCount(cart: Cart | null): number {
  if (!cart) return 0;
  return cart.items.reduce((sum, i) => sum + i.quantite, 0);
}
