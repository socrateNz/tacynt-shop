// Consolidation groupe (Phase 3, M20) : shopId=null signifie "toute
// l'organisation" — la policy RLS gère déjà ce cas (app.shop_id non
// positionné = toutes les boutiques visibles), ce helper évite de répéter
// le même ternaire dans chaque clause `where` de chaque rapport.
export function shopScope(shopId: string | null): { shopId: string } | Record<string, never> {
  return shopId ? { shopId } : {};
}
