import type { Prisma } from "@prisma/client";

export type OrgSettings = {
  vendeurDiscountCeiling?: number;
  maxOfflineDays?: number;
  maxOfflineTickets?: number;
};

// organizations.settings est un Json libre — jamais fait confiance sans
// validation de forme avant de le lire.
export function parseOrgSettings(settings: Prisma.JsonValue): OrgSettings {
  if (settings && typeof settings === "object" && !Array.isArray(settings)) {
    return settings as OrgSettings;
  }
  return {};
}
