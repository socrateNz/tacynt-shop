// Matrice de rôles — cahier des charges section 5.8. Les 5 rôles sont
// définis dès maintenant même si l'UI de Phase 1 n'exerce à fond que
// Propriétaire/Gérant/Vendeur : le coût de les définir maintenant est nul,
// le refaire plus tard (migration + UI) ne l'est pas.
export type Role =
  | "PROPRIETAIRE"
  | "GERANT"
  | "RESPONSABLE_STOCK"
  | "VENDEUR"
  | "COMPTABLE";

export type Capability =
  | "catalog:read"
  | "catalog:write"
  | "stock:read"
  | "stock:write"
  | "pos:sell"
  | "pos:cancel_ticket"
  | "pos:view_cost"
  | "pos:discount:unlimited"
  | "cash_session:manage"
  | "reports:read"
  | "users:manage"
  | "billing:manage"
  | "audit:read";

const ALL_CAPABILITIES: Capability[] = [
  "catalog:read",
  "catalog:write",
  "stock:read",
  "stock:write",
  "pos:sell",
  "pos:cancel_ticket",
  "pos:view_cost",
  "pos:discount:unlimited",
  "cash_session:manage",
  "reports:read",
  "users:manage",
  "billing:manage",
  "audit:read",
];

const CAPABILITIES_BY_ROLE: Record<Role, Capability[]> = {
  // Tout, y compris la facturation SaaS et la suppression de l'organisation.
  PROPRIETAIRE: ALL_CAPABILITIES,
  // Tout sur ses boutiques affectées, sauf la facturation SaaS.
  GERANT: ALL_CAPABILITIES.filter((c) => c !== "billing:manage"),
  // Catalogue, réceptions, inventaires, transferts. Pas d'accès caisse.
  RESPONSABLE_STOCK: ["catalog:read", "catalog:write", "stock:read", "stock:write"],
  // Caisse uniquement (ouverture/fermeture de sa session incluse — "caisse
  // uniquement" au sens plein du terme). Ne voit ni prix d'achat ni marge,
  // ne peut ni annuler un ticket ni accorder une remise au-delà du plafond
  // configuré.
  VENDEUR: ["pos:sell", "cash_session:manage"],
  // Lecture seule sur ventes, achats, dépenses, exports.
  COMPTABLE: ["reports:read"],
};

export function hasCapability(role: Role, capability: Capability): boolean {
  return CAPABILITIES_BY_ROLE[role].includes(capability);
}

export function assertCapability(role: Role, capability: Capability): void {
  if (!hasCapability(role, capability)) {
    throw new Error(`Rôle "${role}" non autorisé pour "${capability}".`);
  }
}

// Plafond de remise vendeur : configuré par organisation
// (organizations.settings.vendeurDiscountCeiling), en valeur ou en
// pourcentage selon la ligne de vente. Un Gérant/Propriétaire n'a pas de
// plafond (pos:discount:unlimited).
export function canApplyDiscount(
  role: Role,
  discountAmount: number,
  ceiling: number,
): boolean {
  if (hasCapability(role, "pos:discount:unlimited")) return true;
  return discountAmount <= ceiling;
}
