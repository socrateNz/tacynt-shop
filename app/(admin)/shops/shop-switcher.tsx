"use client";

import { setActiveShop } from "./actions";

export function ShopSwitcher({
  shops,
  activeShopId,
}: {
  shops: { id: string; nom: string }[];
  activeShopId: string;
}) {
  if (shops.length <= 1) return null;

  return (
    <form action={setActiveShop}>
      <select
        name="shopId"
        defaultValue={activeShopId}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="h-8 rounded-md border border-border bg-background px-2.5 text-sm text-foreground"
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
