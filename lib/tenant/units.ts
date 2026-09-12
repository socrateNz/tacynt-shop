// Unités de vente couvrant les profils métier existants (lib/tenant/profile.ts)
// — épicerie/alimentaire (poids, volume, conditionnements), pharmacie
// (flacon, tube, plaquette), quincaillerie (longueur, rouleau), prêt-à-porter
// (paire) — plus les valeurs génériques universelles.
export const SALE_UNITS = [
  { value: "piece", label: "Pièce" },
  { value: "unite", label: "Unité" },
  { value: "kg", label: "Kilogramme (kg)" },
  { value: "g", label: "Gramme (g)" },
  { value: "l", label: "Litre (L)" },
  { value: "ml", label: "Millilitre (mL)" },
  { value: "m", label: "Mètre (m)" },
  { value: "cm", label: "Centimètre (cm)" },
  { value: "paire", label: "Paire" },
  { value: "douzaine", label: "Douzaine" },
  { value: "sachet", label: "Sachet" },
  { value: "paquet", label: "Paquet" },
  { value: "carton", label: "Carton" },
  { value: "sac", label: "Sac" },
  { value: "boite", label: "Boîte" },
  { value: "bouteille", label: "Bouteille" },
  { value: "flacon", label: "Flacon" },
  { value: "tube", label: "Tube" },
  { value: "plaquette", label: "Plaquette" },
  { value: "rouleau", label: "Rouleau" },
  { value: "barquette", label: "Barquette" },
  { value: "lot", label: "Lot" },
] as const;

export type SaleUnit = (typeof SALE_UNITS)[number]["value"];
