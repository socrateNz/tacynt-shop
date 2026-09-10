import { headers } from "next/headers";

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
  | "shops:manage"
  | "transfers:manage"
  | "catalog:read"
  | "catalog:write"
  | "catalog:import"
  | "customers:manage"
  | "suppliers:manage"
  | "purchasing:manage"
  | "expenses:manage"
  | "expenses:approve"
  | "inventory:manage"
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
  | "audit:read"
  | "accounting:manage"
  | "ecommerce:manage"
  | "white_label:manage";

const ALL_CAPABILITIES: Capability[] = [
  "shops:manage",
  "transfers:manage",
  "catalog:read",
  "catalog:write",
  "catalog:import",
  "customers:manage",
  "suppliers:manage",
  "purchasing:manage",
  "expenses:manage",
  "expenses:approve",
  "inventory:manage",
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
  "accounting:manage",
  "ecommerce:manage",
  "white_label:manage",
];

const CAPABILITIES_BY_ROLE: Record<Role, Capability[]> = {
  // Tout, y compris la facturation SaaS et la suppression de l'organisation.
  PROPRIETAIRE: ALL_CAPABILITIES,
  // Tout sur ses boutiques affectées, sauf la facturation SaaS.
  GERANT: ALL_CAPABILITIES.filter((c) => c !== "billing:manage"),
  // Catalogue, réceptions, inventaires, transferts. Pas d'accès caisse.
  RESPONSABLE_STOCK: [
    "catalog:read",
    "catalog:write",
    "catalog:import",
    "stock:read",
    "stock:write",
    "suppliers:manage",
    "purchasing:manage",
    "inventory:manage",
    "transfers:manage",
  ],
  // Caisse uniquement (ouverture/fermeture de sa session incluse — "caisse
  // uniquement" au sens plein du terme). Ne voit ni prix d'achat ni marge,
  // ne peut ni annuler un ticket ni accorder une remise au-delà du plafond
  // configuré. expenses:manage inclus : une dépense en espèces payée
  // pendant son propre service doit pouvoir être saisie pour que le
  // rapprochement de caisse à la fermeture soit exact — jamais
  // expenses:approve, une dépense au-delà du seuil reste EN_ATTENTE.
  VENDEUR: ["pos:sell", "cash_session:manage", "expenses:manage"],
  // Lecture seule sur ventes, achats, dépenses, exports — plus la gestion de
  // l'export/mapping comptable (Phase 4, M28), qui est littéralement sa
  // fonction, pas une exception au principe "lecture seule".
  COMPTABLE: ["reports:read", "accounting:manage"],
};

export function hasCapability(role: Role, capability: Capability): boolean {
  return CAPABILITIES_BY_ROLE[role].includes(capability);
}

// Capacités qui doivent rester fonctionnelles même en statut SUSPENDED
// (impayé) — la caisse (vente, encaissement, ouverture/fermeture de
// session) et toute lecture, jamais l'écriture "admin" (section 9.3 :
// "couper l'encaissement d'un commerçant est le meilleur moyen de le
// perdre définitivement"). expenses:manage est inclus car saisi aussi par
// le VENDEUR en cours de service (dépense en espèces au comptoir), pas
// seulement par le back-office.
const ALWAYS_ALLOWED_WHEN_SUSPENDED = new Set<Capability>([
  "catalog:read",
  "stock:read",
  "reports:read",
  "audit:read",
  "pos:sell",
  "pos:cancel_ticket",
  "pos:view_cost",
  "pos:discount:unlimited",
  "cash_session:manage",
  "expenses:manage",
]);

export class OrganizationSuspendedError extends Error {
  constructor() {
    super(
      "Cette organisation est suspendue (abonnement impayé) : les actions d'administration sont bloquées, la caisse reste utilisable.",
    );
    this.name = "OrganizationSuspendedError";
  }
}

// Lit x-tenant-org-status posé par proxy.ts (jamais transmis par le client,
// même garde anti-spoofing que le reste du contexte tenant — cf.
// lib/tenant/context.ts). Async à cause de headers() (Next 16) : chaque
// site d'appel devient `await assertCapability(...)`, un changement
// mécanique appliqué à tous les appels existants plutôt que de dupliquer ce
// contrôle dans chaque action.
export async function assertCapability(role: Role, capability: Capability): Promise<void> {
  if (!hasCapability(role, capability)) {
    throw new Error(`Rôle "${role}" non autorisé pour "${capability}".`);
  }
  if (!ALWAYS_ALLOWED_WHEN_SUSPENDED.has(capability)) {
    const h = await headers();
    if (h.get("x-tenant-org-status") === "SUSPENDED") {
      throw new OrganizationSuspendedError();
    }
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
