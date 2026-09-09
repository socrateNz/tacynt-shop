import { redirect } from "next/navigation";

import { systemPrisma } from "@/lib/db/system-client";
import { hasCapability } from "@/lib/permissions";
import { getTenantContext } from "@/lib/tenant/context";

import { ProfilMetierForm } from "./settings-form";

export default async function SettingsPage() {
  const ctx = await getTenantContext();
  if (!hasCapability(ctx.role, "shops:manage")) {
    redirect("/");
  }

  const organization = await systemPrisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
  });

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Paramètres</h1>
      </header>

      <ProfilMetierForm profilMetier={organization.profilMetier} />
    </div>
  );
}
