// Consolidation (Phase 3, M20) : shopId=null signifiait à l'origine "toute
// l'organisation", en s'appuyant sur la policy RLS (app.shop_id non
// positionné = toutes les boutiques visibles). Corrigé : ce comportement
// n'est sûr que si l'appelant a lui-même vérifié qu'il a le droit de voir
// "toutes les boutiques" — en pratique, aucun rôle n'a ce droit par défaut,
// seulement "ses boutiques affectées" (lib/tenant/active-shop.ts,
// getAssignedShopIds). shopId accepte donc aussi un tableau explicite : un
// filtre `shopId IN (...)` appliqué par Prisma, indépendant de la policy
// RLS — correct même quand les boutiques affectées ne sont qu'un
// sous-ensemble de celles de l'organisation.
export function shopScope(
  shopId: string | string[] | null,
): { shopId: string } | { shopId: { in: string[] } } | Record<string, never> {
  if (!shopId) return {};
  return Array.isArray(shopId) ? { shopId: { in: shopId } } : { shopId };
}
