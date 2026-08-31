import { NextResponse } from "next/server";

import { recordAuditLog } from "@/lib/audit";
import { verifyTotp } from "@/lib/auth/mfa";
import { systemPrisma } from "@/lib/db/system-client";
import { getTenantContext } from "@/lib/tenant/context";

export async function POST(request: Request) {
  const ctx = await getTenantContext();
  const body = await request.json();
  const token = String(body.token ?? "").trim();

  const user = await systemPrisma.user.findUniqueOrThrow({ where: { id: ctx.userId } });
  if (!user.mfaSecret || !verifyTotp(user.mfaSecret, token)) {
    return NextResponse.json({ error: "Code invalide." }, { status: 400 });
  }

  await systemPrisma.user.update({ where: { id: user.id }, data: { mfaEnabled: true } });
  await recordAuditLog(systemPrisma, {
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "MFA_ENABLED",
    entite: "user",
    entiteId: ctx.userId,
  });

  return NextResponse.json({ ok: true });
}
