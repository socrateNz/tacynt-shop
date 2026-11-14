// Marketplace de modules (Phase 4, M26) : activation exclusivement pilotée
// par l'admin plateforme (app/platform/(authenticated)/organization-detail-actions.ts), jamais
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
  {
    key: "location",
    label: "Location",
    desc: "Location de logements (chambres, studios, appartements, villas) : échéancier et suivi des paiements.",
  },
  {
    key: "location_vehicules",
    label: "Location de véhicules",
    desc: "Catalogue de véhicules loués à la journée, avec ou sans chauffeur : demandes, réservations par dates, caution.",
  },
  {
    key: "blanchisserie",
    label: "Blanchisserie",
    desc: "Catalogue de pièces à laver (prix par pièce), commandes avec collecte/dépôt et recomptage.",
  },
  {
    key: "marketplace",
    label: "Marketplace mobile",
    desc: "Produits et logements visibles dans l'application mobile multi-boutiques.",
  },
] as const;

export type ModuleKey = (typeof MODULE_CATALOG)[number]["key"];

export function organizationHasModule(enabledModules: unknown, key: ModuleKey): boolean {
  return Array.isArray(enabledModules) && enabledModules.includes(key);
}
