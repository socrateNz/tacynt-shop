import { createHash, randomBytes } from "node:crypto";

import { platformPrisma } from "@/lib/db/platform-client";

export const PLATFORM_SESSION_COOKIE_NAME = "ts_platform_session";
// Plus courte qu'une session commerçant (30 jours, lib/auth/session.ts) :
// un compte cross-organisation mérite une durée de vie plus resserrée.
const PLATFORM_SESSION_DURATION_MS = 12 * 60 * 60 * 1000;

function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createPlatformSession(params: {
  platformAdminId: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + PLATFORM_SESSION_DURATION_MS);

  await platformPrisma.platformAdminSession.create({
    data: {
      platformAdminId: params.platformAdminId,
      tokenHash: hashToken(token),
      expiresAt,
      ip: params.ip ?? null,
      userAgent: params.userAgent ?? null,
    },
  });

  return { token, expiresAt };
}

export async function findPlatformSessionByToken(token: string) {
  const session = await platformPrisma.platformAdminSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { platformAdmin: true },
  });

  if (!session || session.expiresAt < new Date() || !session.platformAdmin.actif) {
    return null;
  }

  return session;
}

export async function deletePlatformSessionByToken(token: string): Promise<void> {
  await platformPrisma.platformAdminSession.deleteMany({ where: { tokenHash: hashToken(token) } });
}
