// Marketplace de modules (Phase 4, M26) : activation exclusivement pilotée
// par l'admin plateforme (app/platform/[organizationId]/actions.ts), jamais
// en self-service — même modèle économique que le plan/statut (M25),
// "l'admin gère les abonnements après avoir perçu en espèces". Axe
// indépendant de lib/permissions.ts (rôle) et lib/quotas.ts (limites
// numériques par plan) : un module désactivé masque la fonctionnalité pour
// TOUS les rôles de l'organisation, quelle que soit leur capacité.
export const MODULE_CATALOG = [
  {
    key: "accounting_connectors",
    label: "Connecteurs comptables",
    desc: "Export du journal comptable (débit/crédit) sur la période, format générique.",
  },
  {
    key: "ecommerce",
    label: "E-commerce",
    desc: "Boutique en ligne : commande à distance, paiement au retrait/à la livraison.",
  },
] as const;

export type ModuleKey = (typeof MODULE_CATALOG)[number]["key"];

export function organizationHasModule(enabledModules: unknown, key: ModuleKey): boolean {
  return Array.isArray(enabledModules) && enabledModules.includes(key);
}
