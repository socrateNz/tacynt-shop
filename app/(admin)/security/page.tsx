import { Page, PageHeader } from "@/components/admin/page";
import { systemPrisma } from "@/lib/db/system-client";
import { getTenantContext } from "@/lib/tenant/context";

import { MfaSettings } from "./mfa-settings";

export default async function SecurityPage() {
  const ctx = await getTenantContext();
  const user = await systemPrisma.user.findUniqueOrThrow({ where: { id: ctx.userId } });

  return (
    <Page>
      <PageHeader
        title="Sécurité"
        description="Paramètres de sécurité de votre compte."
      />

      <MfaSettings initiallyEnabled={user.mfaEnabled} />
    </Page>
  );
}
