"use client";

import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxInputGroup,
  ComboboxItem,
  ComboboxTriggerIcon,
} from "@/components/ui/combobox";
import { SALE_UNITS } from "@/lib/tenant/units";

// Liste fermée (pas de champ libre) : partagé par les 3 formulaires qui
// saisissent l'unité d'une variante (création multi-variantes, édition
// rapide, édition dédiée).
export function UnitCombobox({
  name,
  id,
  defaultValue = "piece",
}: {
  name: string;
  id?: string;
  defaultValue?: string;
}) {
  return (
    <Combobox items={SALE_UNITS} name={name} defaultValue={defaultValue} autoHighlight>
      <ComboboxInputGroup>
        <ComboboxInput id={id} placeholder="Rechercher une unité..." />
        <ComboboxTriggerIcon />
      </ComboboxInputGroup>
      <ComboboxContent>
        {(item: (typeof SALE_UNITS)[number]) => (
          <ComboboxItem key={item.value} value={item.value}>
            {item.label}
          </ComboboxItem>
        )}
      </ComboboxContent>
    </Combobox>
  );
}
