// Configuration par profil métier (cahier des charges section 6) : un socle
// unique, des profils qui activent les spécificités. Organization.profilMetier
// est en base depuis la Phase 1 mais n'était exploité par aucun code avant
// la Phase 3 — ces helpers sont le premier point d'activation réel.
export const PROFILES = [
  { value: "generique", label: "Générique" },
  { value: "epicerie", label: "Épicerie / alimentaire" },
  { value: "pret_a_porter", label: "Prêt-à-porter" },
  { value: "electronique", label: "Électronique" },
  { value: "quincaillerie", label: "Quincaillerie" },
  { value: "pharmacie", label: "Pharmacie / parapharmacie" },
] as const;

export type ProfilMetier = (typeof PROFILES)[number]["value"];

// Épicerie ET pharmacie activent les lots/péremption (section 6) — la
// pharmacie ajoute une péremption stricte (section 5.1) mais le mécanisme
// de suivi (numéro de lot, date, FEFO) est le même pour les deux.
export function profileHasLots(profilMetier: string): boolean {
  return profilMetier === "epicerie" || profilMetier === "pharmacie";
}

export function profileHasSerialNumbers(profilMetier: string): boolean {
  return profilMetier === "electronique";
}
