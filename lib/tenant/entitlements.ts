// Flags booléens dérivés du plan (Phase 4, M27) — par opposition à
// lib/quotas.ts (purement numérique) et lib/tenant/modules.ts (activation
// manuelle par l'admin plateforme, indépendante du plan). Catégorie encore
// petite : un seul flag aujourd'hui, pensée pour accueillir la prochaine
// fonctionnalité "réservée à un plan" sans raccrocher un
// `if (plan === "ENTERPRISE")` recopié à chaque site d'appel.
export function organizationCanUseWhiteLabel(plan: string): boolean {
  return plan === "ENTERPRISE";
}
