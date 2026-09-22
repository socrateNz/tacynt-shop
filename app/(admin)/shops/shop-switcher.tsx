"use client";

import { setActiveShop } from "./actions";

export function ShopSwitcher({
  shops,
  activeShopId,
  canSwitch,
}: {
  shops: { id: string; nom: string }[];
  activeShopId: string;
  // Seuls les rôles qui administrent le réseau de boutiques (shops:manage —
  // Propriétaire/Gérant) ont ce sélecteur : un rôle "de terrain" (Vendeur,
  // Responsable stock, Comptable) affecté par erreur ou par exception à
  // plusieurs boutiques ne doit même pas voir qu'il pourrait en changer,
  // même si setActiveShop() continue par ailleurs de refuser toute boutique
  // hors de ses propres affectations (voir app/(admin)/shops/actions.ts).
  canSwitch: boolean;
}) {
  if (!canSwitch || shops.length <= 1) return null;

  return (
    <form action={setActiveShop}>
      <select
        name="shopId"
        defaultValue={activeShopId}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="h-8 max-w-32 rounded-md border border-border bg-background px-2.5 text-sm text-foreground sm:max-w-56"
      >
        {shops.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nom}
          </option>
        ))}
      </select>
    </form>
  );
}
