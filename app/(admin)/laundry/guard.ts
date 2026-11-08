import { redirect } from "next/navigation";

import { systemPrisma } from "@/lib/db/system-client";
import { hasCapability } from "@/lib/permissions";
import { getTenantContext } from "@/lib/tenant/context";
import { organizationHasModule } from "@/lib/tenant/modules";

// Garde commune des pages Blanchisserie : capacité du rôle ET module activé.
export async function requireLaundryPage() {
  const ctx = await getTenantContext();
  const organization = await systemPrisma.organization.findUniqueOrThrow({ where: { id: ctx.organizationId } });
  if (!hasCapability(ctx.role, "laundry:manage") || !organizationHasModule(organization.enabledModules, "blanchisserie")) {
    redirect("/dashboard");
  }
  return { ctx, organization };
}
