import { headers } from "next/headers";

import type { Role } from "@/lib/permissions";

export type TenantContext = {
  organizationId: string;
  userId: string;
  role: Role;
};

// Lit les headers posés par proxy.ts (jamais transmis par le client dans le
// corps de la requête — cahier des charges 4.3). headers() est async depuis
// Next 15/16.
export async function getTenantContext(): Promise<TenantContext> {
  const h = await headers();
  const organizationId = h.get("x-tenant-org-id");
  const userId = h.get("x-user-id");
  const role = h.get("x-user-role") as Role | null;

  if (!organizationId || !userId || !role) {
    throw new Error(
      "Contexte tenant manquant : cette requête n'est pas passée par proxy.ts avec une session valide.",
    );
  }

  return { organizationId, userId, role };
}
