import { systemPrisma } from "@/lib/db/system-client";
import { getTenantContext } from "@/lib/tenant/context";

import { MfaSettings } from "./mfa-settings";

export default async function SecurityPage() {
  const ctx = await getTenantContext();
  const user = await systemPrisma.user.findUniqueOrThrow({ where: { id: ctx.userId } });

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Sécurité</h1>
        <p className="text-sm text-muted-foreground">Paramètres de sécurité de votre compte.</p>
      </header>

      <MfaSettings initiallyEnabled={user.mfaEnabled} />
    </div>
  );
}
