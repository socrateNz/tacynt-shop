import type { Prisma } from "@prisma/client";

export type OrgSettings = {
  vendeurDiscountCeiling?: number;
  maxOfflineDays?: number;
  maxOfflineTickets?: number;
  // Dépense auto-validée si son montant est <= ce seuil ET que son auteur
  // n'a pas expenses:approve (qui auto-valide toujours ses propres saisies).
  // Non configuré => 0 : rien n'est auto-validé par défaut tant que
  // l'organisation n'a pas explicitement choisi un seuil (section M15).
  expenseApprovalThreshold?: number;
};

// organizations.settings est un Json libre — jamais fait confiance sans
// validation de forme avant de le lire.
export function parseOrgSettings(settings: Prisma.JsonValue): OrgSettings {
  if (settings && typeof settings === "object" && !Array.isArray(settings)) {
    return settings as OrgSettings;
  }
  return {};
}
