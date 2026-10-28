// Unités de vente couvrant les profils métier existants (lib/tenant/profile.ts)
// — épicerie/alimentaire (poids, volume, conditionnements), pharmacie
// (flacon, tube, plaquette), quincaillerie (longueur, rouleau), prêt-à-porter
// (paire) — plus les valeurs génériques universelles. Types de base
// uniquement (jamais de taille pré-composée du type "250ml") — la quantité
// se saisit séparément sur la variante (ProductVariant.uniteQuantite) et se
// combine à l'affichage via formatUnite() ci-dessous.
export const SALE_UNITS = [
  { value: "piece", label: "Pièce" },
  { value: "unite", label: "Unité" },
  { value: "lot", label: "Lot" },
  { value: "paire", label: "Paire" },
  { value: "douzaine", label: "Douzaine" },
  { value: "ensemble", label: "Ensemble" },
  { value: "kit", label: "Kit" },
  { value: "g", label: "Gramme (g)" },
  { value: "kg", label: "Kilogramme (kg)" },
  { value: "tonne", label: "Tonne" },
  { value: "ml", label: "Millilitre (mL)" },
  { value: "cl", label: "Centilitre (cL)" },
  { value: "l", label: "Litre (L)" },
  { value: "mm", label: "Millimètre (mm)" },
  { value: "cm", label: "Centimètre (cm)" },
  { value: "m", label: "Mètre (m)" },
  { value: "sachet", label: "Sachet" },
  { value: "paquet", label: "Paquet" },
  { value: "carton", label: "Carton" },
  { value: "sac", label: "Sac" },
  { value: "boite", label: "Boîte" },
  { value: "bouteille", label: "Bouteille" },
  { value: "canette", label: "Canette" },
  { value: "pack", label: "Pack" },
  { value: "bidon", label: "Bidon" },
  { value: "jerrican", label: "Jerrican" },
  { value: "fut", label: "Fût" },
  { value: "rouleau", label: "Rouleau" },
  { value: "bobine", label: "Bobine" },
  { value: "barquette", label: "Barquette" },
  { value: "flacon", label: "Flacon" },
  { value: "tube", label: "Tube" },
  { value: "plaquette", label: "Plaquette" },
  { value: "ampoule", label: "Ampoule" },
  { value: "gelule", label: "Gélule" },
  { value: "comprime", label: "Comprimé" },
  { value: "sachet_dose", label: "Sachet-dose" },
  { value: "suppositoire", label: "Suppositoire" },
  { value: "seringue", label: "Seringue" },
  { value: "pot", label: "Pot" },
] as const;

export type SaleUnit = (typeof SALE_UNITS)[number]["value"];

// Combine la quantité et le type d'unité de la variante en un libellé unique
// ("1" + "l" -> "1l", "250" + "ml" -> "250ml") — utilisé uniquement là où
// l'affichage doit être compact (vitrine, caisse) ; les formulaires admin
// gardent les deux champs séparés, jamais cette chaîne composée.
export function formatUnite(quantite: number, unite: string): string {
  return `${quantite}${unite}`;
}
