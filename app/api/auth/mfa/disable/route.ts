import { NextResponse } from "next/server";

import { recordAuditLog } from "@/lib/audit";
import { systemPrisma } from "@/lib/db/system-client";
import { getTenantContext } from "@/lib/tenant/context";

export async function POST() {
  const ctx = await getTenantContext();

  await systemPrisma.user.update({
    where: { id: ctx.userId },
    data: { mfaEnabled: false, mfaSecret: null },
  });

  await recordAuditLog(systemPrisma, {
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "MFA_DISABLED",
    entite: "user",
    entiteId: ctx.userId,
  });

  return NextResponse.json({ ok: true });
}
