import { headers } from "next/headers";

import { hasCapability, type Capability, type Role } from "@/lib/permissions";

// Server-only (next/headers) — séparé de lib/permissions.ts pour que ce
// dernier reste importable depuis un Client Component (voir le commentaire
// dans lib/permissions.ts). Toute Server Action / Route Handler qui appelait
// assertCapability depuis "@/lib/permissions" l'importe désormais d'ici.

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
