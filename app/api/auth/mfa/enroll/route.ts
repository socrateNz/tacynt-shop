import { NextResponse } from "next/server";
import QRCode from "qrcode";

import { generateMfaSecret, getOtpAuthUrl } from "@/lib/auth/mfa";
import { systemPrisma } from "@/lib/db/system-client";
import { getTenantContext } from "@/lib/tenant/context";

// Étape 1 de l'activation : génère un secret et un QR code, mais
// mfaEnabled reste faux tant que /mfa/confirm n'a pas validé un code réel
// (évite de s'enfermer hors de son propre compte avec une appli mal réglée).
export async function POST() {
  const ctx = await getTenantContext();

  const [user, organization] = await Promise.all([
    systemPrisma.user.findUniqueOrThrow({ where: { id: ctx.userId } }),
    systemPrisma.organization.findUniqueOrThrow({ where: { id: ctx.organizationId } }),
  ]);

  const secret = generateMfaSecret();
  await systemPrisma.user.update({
    where: { id: user.id },
    data: { mfaSecret: secret, mfaEnabled: false },
  });

  const otpauthUrl = getOtpAuthUrl(secret, user.email, organization.nom);
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl);

  return NextResponse.json({ secret, qrDataUrl });
}
