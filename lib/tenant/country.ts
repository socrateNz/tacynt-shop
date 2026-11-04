// Pays d'une organisation (ISO 3166-1 alpha-2), choisi à la création par
// l'admin plateforme. Liste curatée, même patron que CURRENCIES
// (lib/tenant/currency.ts). Le pays décide des moyens de paiement en ligne :
// Cameroun = Mobile Money (Codees) + carte (Stripe), ailleurs = carte
// uniquement (lib/payments/methods.ts).
export const COUNTRIES = [
  { value: "CM", label: "Cameroun" },
  { value: "SN", label: "Sénégal" },
  { value: "CI", label: "Côte d'Ivoire" },
  { value: "GA", label: "Gabon" },
  { value: "CG", label: "Congo" },
  { value: "CD", label: "RD Congo" },
  { value: "TD", label: "Tchad" },
  { value: "CF", label: "Centrafrique" },
  { value: "GQ", label: "Guinée équatoriale" },
  { value: "BJ", label: "Bénin" },
  { value: "TG", label: "Togo" },
  { value: "BF", label: "Burkina Faso" },
  { value: "ML", label: "Mali" },
  { value: "NE", label: "Niger" },
  { value: "GN", label: "Guinée" },
  { value: "NG", label: "Nigeria" },
  { value: "GH", label: "Ghana" },
  { value: "MA", label: "Maroc" },
  { value: "TN", label: "Tunisie" },
  { value: "FR", label: "France" },
  { value: "BE", label: "Belgique" },
  { value: "CH", label: "Suisse" },
  { value: "CA", label: "Canada" },
  { value: "US", label: "États-Unis" },
  { value: "GB", label: "Royaume-Uni" },
] as const;

export type Pays = (typeof COUNTRIES)[number]["value"];

export function isValidCountry(value: string): value is Pays {
  return COUNTRIES.some((c) => c.value === value);
}

export function countryLabel(value: string): string {
  return COUNTRIES.find((c) => c.value === value)?.label ?? value;
}
