// Calcul HT/taxe/TTC d'une ligne, partagé entre le serveur
// (lib/sales/apply-sale.ts) et le panier caisse (pos-client.tsx) — jamais
// deux implémentations séparées du même calcul, même règle que le
// stock/CUMP. Le sens dépend d'un réglage par boutique
// (Shop.taxeRetenueSource) :
// - true (défaut) : le prix saisi est HT, la taxe s'ajoute par-dessus.
// - false : la taxe est déjà retenue à la source, donc déjà incluse dans
//   le prix saisi — le HT/la taxe affichés se retrouvent par soustraction,
//   mais le TTC facturé reste le prix saisi, inchangé.
export function computeLineAmounts({
  prixUnitaire,
  quantite,
  remise,
  tauxTaxe,
  taxeRetenueSource,
}: {
  prixUnitaire: number;
  quantite: number;
  remise: number;
  tauxTaxe: number;
  taxeRetenueSource: boolean;
}): { ligneHt: number; ligneTaxe: number; ligneTtc: number } {
  const montantBrut = prixUnitaire * quantite - remise;

  if (taxeRetenueSource) {
    const ligneHt = montantBrut;
    const ligneTaxe = ligneHt * (tauxTaxe / 100);
    return { ligneHt, ligneTaxe, ligneTtc: ligneHt + ligneTaxe };
  }

  const ligneTtc = montantBrut;
  const ligneHt = ligneTtc / (1 + tauxTaxe / 100);
  return { ligneHt, ligneTaxe: ligneTtc - ligneHt, ligneTtc };
}
