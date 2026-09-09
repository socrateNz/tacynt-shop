import { headers } from "next/headers";

export type PlatformAdminContext = {
  platformAdminId: string;
};

// Lit x-platform-admin-id posé par proxy.ts (jamais transmis par le
// client — même garde anti-spoofing que le contexte tenant, cf.
// lib/tenant/context.ts). Distinct de getTenantContext() : un admin
// plateforme n'a ni organizationId ni role au sens des organisations.
export async function getPlatformAdminContext(): Promise<PlatformAdminContext> {
  const h = await headers();
  const platformAdminId = h.get("x-platform-admin-id");

  if (!platformAdminId) {
    throw new Error(
      "Contexte admin plateforme manquant : cette requête n'est pas passée par proxy.ts avec une session admin valide.",
    );
  }

  return { platformAdminId };
}
