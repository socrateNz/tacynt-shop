"use client";

import { useState, type ComponentProps } from "react";

// Champ de quantité du panier, saisissable au clavier : vider le champ pour
// retaper un nombre ne doit pas retirer l'article (une quantité 0 le retire
// du panier). Seule une quantité positive est appliquée pendant la frappe ;
// en quittant le champ, il revient à la quantité réelle du panier.
export function CartQuantityInput({
  value,
  onCommit,
  as: Component = "input",
  ...props
}: Omit<ComponentProps<"input">, "value" | "onChange" | "onBlur" | "type"> & {
  value: number;
  onCommit: (quantite: number) => void;
  as?: "input" | React.ComponentType<ComponentProps<"input">>;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <Component
      {...props}
      type="number"
      inputMode="numeric"
      value={draft ?? value}
      onChange={(e) => {
        setDraft(e.target.value);
        const quantite = Number(e.target.value);
        if (e.target.value !== "" && Number.isFinite(quantite) && quantite > 0) onCommit(quantite);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}
