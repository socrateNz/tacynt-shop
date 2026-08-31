import { createHash, randomBytes } from "node:crypto";

import { systemPrisma } from "@/lib/db/system-client";

export const SESSION_COOKIE_NAME = "ts_session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// La résolution de session précède la résolution du tenant (proxy.ts doit
// savoir QUI se connecte avant de savoir si la session appartient bien à
// l'organisation visée) : comme l'inscription, c'est un cas légitime
// d'utilisation du rôle système, au même titre que le bootstrap de compte.
export async function createSession(params: {
  userId: string;
  organizationId: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await systemPrisma.session.create({
    data: {
      userId: params.userId,
      organizationId: params.organizationId,
      tokenHash: hashToken(token),
      expiresAt,
      ip: params.ip ?? null,
      userAgent: params.userAgent ?? null,
    },
  });

  return { token, expiresAt };
}

export async function findSessionByToken(token: string) {
  const session = await systemPrisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date() || !session.user.actif) {
    return null;
  }

  return session;
}

export async function deleteSessionByToken(token: string): Promise<void> {
  await systemPrisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}
