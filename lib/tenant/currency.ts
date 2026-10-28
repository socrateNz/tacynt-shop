// Liste curatée plutôt qu'un champ libre (M35) : lib/money.ts formate déjà
// n'importe quel code ISO 4217 valide via Intl.NumberFormat, mais un code
// invalide y lève une RangeError — casserait l'affichage monétaire de tout
// le tenant. Même patron que PROFILES (lib/tenant/profile.ts).
export const CURRENCIES = [
  { value: "XOF", label: "Franc CFA — UEMOA (XOF)" },
  { value: "XAF", label: "Franc CFA — CEMAC (XAF)" },
  { value: "EUR", label: "Euro (EUR)" },
  { value: "USD", label: "Dollar américain (USD)" },
  { value: "GNF", label: "Franc guinéen (GNF)" },
  { value: "NGN", label: "Naira nigérian (NGN)" },
  { value: "GHS", label: "Cedi ghanéen (GHS)" },
  { value: "MAD", label: "Dirham marocain (MAD)" },
  { value: "CDF", label: "Franc congolais (CDF)" },
  { value: "CAD", label: "Dollar canadien (CAD)" },
] as const;

export type Devise = (typeof CURRENCIES)[number]["value"];

export function isValidCurrency(value: string): value is Devise {
  return CURRENCIES.some((c) => c.value === value);
}
