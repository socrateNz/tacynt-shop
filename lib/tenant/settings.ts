import type { PaymentMode, Prisma } from "@prisma/client";

export type OrgSettings = {
  vendeurDiscountCeiling?: number;
  maxOfflineDays?: number;
  maxOfflineTickets?: number;
  // Dépense auto-validée si son montant est <= ce seuil ET que son auteur
  // n'a pas expenses:approve (qui auto-valide toujours ses propres saisies).
  // Non configuré => 0 : rien n'est auto-validé par défaut tant que
  // l'organisation n'a pas explicitement choisi un seuil (section M15).
  expenseApprovalThreshold?: number;
  // Fidélité (section 5.4, Phase 3 M21) : 1 point gagné par tranche de
  // loyaltyPointsPerAmount dépensée (TTC) sur une vente rattachée à un
  // client. Non configuré ou <= 0 => aucun point n'est jamais accordé,
  // l'organisation doit explicitement activer le programme.
  loyaltyPointsPerAmount?: number;
  // Valeur d'un point converti en crédit client (montant = points ×
  // loyaltyPointValue). Non configuré ou <= 0 => conversion désactivée.
  loyaltyPointValue?: number;
  // White label (Phase 4, M27) : cosmétique, jamais filtré en WHERE — même
  // profil que les clés ci-dessus. hasLogo évite de lire
  // organization_branding juste pour décider d'afficher une balise <img>.
  branding?: {
    primaryColor?: string;
    hasLogo?: boolean;
  };
  // Connecteur comptable (Phase 4, M28) : surcharge optionnelle du mapping
  // par défaut (lib/reports/accounting-mapping.ts) — un point de départ
  // éditable, jamais une garantie de conformité comptable certifiée.
  accountingMapping?: {
    ventesCompte?: string;
    tvaCompte?: string;
    paiementComptes?: Partial<Record<PaymentMode, string>>;
    chargesCompteParDefaut?: string;
  };
};

// organizations.settings est un Json libre — jamais fait confiance sans
// validation de forme avant de le lire.
export function parseOrgSettings(settings: Prisma.JsonValue): OrgSettings {
  if (settings && typeof settings === "object" && !Array.isArray(settings)) {
    return settings as OrgSettings;
  }
  return {};
}
