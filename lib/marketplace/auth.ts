import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

import type { MarketplaceCustomer } from "@prisma/client";
import { NextResponse } from "next/server";

import { marketplacePrisma } from "@/lib/db/marketplace-client";
import { sendMail } from "@/lib/email/send";
import { marketplaceVerificationEmail } from "@/lib/email/templates";

// Authentification des clients de l'app mobile Sodu. Connexion par email +
// mot de passe uniquement, email obligatoirement validé (code à 6 chiffres
// envoyé par email) avant qu'une session puisse être ouverte. Jeton opaque
// transmis en "Authorization: Bearer <token>" (pas de cookie : client
// natif), haché en base comme sessions/platform_admin_sessions.
const SESSION_DURATION_MS = 90 * 24 * 60 * 60 * 1000;

export const PASSWORD_MIN_LENGTH = 8;
export const VERIFICATION_CODE_TTL_MINUTES = 15;
export const VERIFICATION_MAX_ATTEMPTS = 5;
export const VERIFICATION_RESEND_COOLDOWN_SECONDS = 60;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

// Numéro de contact (pas un identifiant) : chiffres et "+" uniquement.
export function normalizePhone(raw: string): string {
  return raw.replace(/[^\d+]/g, "");
}

export type PublicCustomer = {
  id: string;
  nom: string;
  email: string;
  telephone: string;
};

export function toPublicCustomer(c: MarketplaceCustomer): PublicCustomer {
  return { id: c.id, nom: c.nom, email: c.email, telephone: c.telephone };
}

// ---------------------------------------------------------------------------
// Code de validation d'email
// ---------------------------------------------------------------------------

// Lié au compte (id en sel) : un code volé ne vaut que pour ce compte.
function hashCode(customerId: string, code: string): string {
  return sha256(`${customerId}:${code}`);
}

export function secondsBeforeResend(customer: MarketplaceCustomer): number {
  if (!customer.verificationCodeSentAt) return 0;
  const elapsed = (Date.now() - customer.verificationCodeSentAt.getTime()) / 1000;
  return Math.max(0, Math.ceil(VERIFICATION_RESEND_COOLDOWN_SECONDS - elapsed));
}

// Génère un nouveau code (l'ancien devient invalide), l'enregistre haché et
// l'envoie par email. Lève si l'envoi échoue : l'appelant répond une erreur
// claire, le client pourra redemander un code.
export async function sendVerificationCode(customer: MarketplaceCustomer): Promise<void> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const now = new Date();
  await marketplacePrisma.marketplaceCustomer.update({
    where: { id: customer.id },
    data: {
      verificationCodeHash: hashCode(customer.id, code),
      verificationCodeExpiresAt: new Date(now.getTime() + VERIFICATION_CODE_TTL_MINUTES * 60 * 1000),
      verificationCodeSentAt: now,
      verificationAttempts: 0,
    },
  });
  const { subject, html, text } = marketplaceVerificationEmail({
    nom: customer.nom,
    code,
    validiteMinutes: VERIFICATION_CODE_TTL_MINUTES,
  });
  await sendMail({ to: customer.email, subject, html, text });
}

export type VerifyResult = "OK" | "INVALIDE" | "EXPIRE" | "TROP_DE_TENTATIVES";

export async function checkVerificationCode(customer: MarketplaceCustomer, code: string): Promise<VerifyResult> {
  if (!customer.verificationCodeHash || !customer.verificationCodeExpiresAt) return "EXPIRE";
  if (customer.verificationAttempts >= VERIFICATION_MAX_ATTEMPTS) return "TROP_DE_TENTATIVES";
  if (customer.verificationCodeExpiresAt < new Date()) return "EXPIRE";

  const expected = Buffer.from(customer.verificationCodeHash, "hex");
  const actual = Buffer.from(hashCode(customer.id, code.trim()), "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    await marketplacePrisma.marketplaceCustomer.update({
      where: { id: customer.id },
      data: { verificationAttempts: { increment: 1 } },
    });
    return "INVALIDE";
  }

  await marketplacePrisma.marketplaceCustomer.update({
    where: { id: customer.id },
    data: {
      emailVerifiedAt: new Date(),
      verificationCodeHash: null,
      verificationCodeExpiresAt: null,
      verificationAttempts: 0,
    },
  });
  return "OK";
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export async function createMarketplaceSession(params: {
  customerId: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await marketplacePrisma.marketplaceSession.create({
    data: {
      marketplaceCustomerId: params.customerId,
      tokenHash: sha256(token),
      expiresAt,
      ip: params.ip ?? null,
      userAgent: params.userAgent ?? null,
    },
  });
  return { token, expiresAt };
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1]!.trim() : null;
}

// Client authentifié de la requête, ou null (jeton absent, inconnu, expiré,
// révoqué, compte désactivé ou email non validé).
export async function getMarketplaceCustomer(request: Request): Promise<MarketplaceCustomer | null> {
  const token = bearerToken(request);
  if (!token) return null;
  const session = await marketplacePrisma.marketplaceSession.findUnique({
    where: { tokenHash: sha256(token) },
    include: { customer: true },
  });
  if (
    !session ||
    session.revokedAt ||
    session.expiresAt < new Date() ||
    !session.customer.actif ||
    !session.customer.emailVerifiedAt
  ) {
    return null;
  }
  return session.customer;
}

export async function revokeMarketplaceSession(request: Request): Promise<void> {
  const token = bearerToken(request);
  if (!token) return;
  await marketplacePrisma.marketplaceSession.updateMany({
    where: { tokenHash: sha256(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export function unauthorized() {
  return NextResponse.json({ error: "Connectez-vous pour continuer." }, { status: 401 });
}

export function requestIp(request: Request): string | null {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

export async function sessionResponse(request: Request, customer: MarketplaceCustomer, status = 200) {
  const { token, expiresAt } = await createMarketplaceSession({
    customerId: customer.id,
    ip: requestIp(request),
    userAgent: request.headers.get("user-agent"),
  });
  return NextResponse.json({ token, expiresAt, customer: toPublicCustomer(customer) }, { status });
}
