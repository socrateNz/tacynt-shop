import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

import type { MarketplaceCustomer, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { marketplacePrisma } from "@/lib/db/marketplace-client";
import { sendMail } from "@/lib/email/send";
import { marketplacePasswordResetEmail, marketplaceVerificationEmail } from "@/lib/email/templates";

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
// Codes à usage unique envoyés par email : validation de l'adresse à
// l'inscription, et réinitialisation du mot de passe. Deux jeux de champs
// distincts : un code d'un type ne vaut jamais pour l'autre.
// ---------------------------------------------------------------------------

export type CodePurpose = "verification" | "reset";

const CODE_FIELDS = {
  verification: {
    hash: "verificationCodeHash",
    expiresAt: "verificationCodeExpiresAt",
    sentAt: "verificationCodeSentAt",
    attempts: "verificationAttempts",
  },
  reset: {
    hash: "resetCodeHash",
    expiresAt: "resetCodeExpiresAt",
    sentAt: "resetCodeSentAt",
    attempts: "resetAttempts",
  },
} as const;

// Lié au compte ET à l'usage : un code volé ne vaut que pour ce compte et
// pour cette action.
function hashCode(customerId: string, purpose: CodePurpose, code: string): string {
  return sha256(`${customerId}:${purpose}:${code}`);
}

export function secondsBeforeResend(customer: MarketplaceCustomer, purpose: CodePurpose = "verification"): number {
  const sentAt = customer[CODE_FIELDS[purpose].sentAt];
  if (!sentAt) return 0;
  const elapsed = (Date.now() - sentAt.getTime()) / 1000;
  return Math.max(0, Math.ceil(VERIFICATION_RESEND_COOLDOWN_SECONDS - elapsed));
}

// Génère un nouveau code (l'ancien du même type devient invalide),
// l'enregistre haché et l'envoie par email. Lève si l'envoi échoue :
// l'appelant répond une erreur claire, le client pourra redemander un code.
export async function sendCode(customer: MarketplaceCustomer, purpose: CodePurpose): Promise<void> {
  const f = CODE_FIELDS[purpose];
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const now = new Date();
  await marketplacePrisma.marketplaceCustomer.update({
    where: { id: customer.id },
    data: {
      [f.hash]: hashCode(customer.id, purpose, code),
      [f.expiresAt]: new Date(now.getTime() + VERIFICATION_CODE_TTL_MINUTES * 60 * 1000),
      [f.sentAt]: now,
      [f.attempts]: 0,
    },
  });
  const input = { nom: customer.nom, code, validiteMinutes: VERIFICATION_CODE_TTL_MINUTES };
  const mail = purpose === "verification" ? marketplaceVerificationEmail(input) : marketplacePasswordResetEmail(input);
  await sendMail({ to: customer.email, ...mail });
}

export function sendVerificationCode(customer: MarketplaceCustomer): Promise<void> {
  return sendCode(customer, "verification");
}

export type VerifyResult = "OK" | "INVALIDE" | "EXPIRE" | "TROP_DE_TENTATIVES";

// Vérifie le code ; en cas de succès il est consommé (remis à null) et les
// effets métier passés dans `onSuccess` (email validé, nouveau mot de
// passe) sont appliqués dans la même mise à jour.
export async function consumeCode(
  customer: MarketplaceCustomer,
  purpose: CodePurpose,
  code: string,
  onSuccess: Prisma.MarketplaceCustomerUpdateInput = {},
): Promise<VerifyResult> {
  const f = CODE_FIELDS[purpose];
  const storedHash = customer[f.hash];
  const expiresAt = customer[f.expiresAt];
  if (!storedHash || !expiresAt) return "EXPIRE";
  if (customer[f.attempts] >= VERIFICATION_MAX_ATTEMPTS) return "TROP_DE_TENTATIVES";
  if (expiresAt < new Date()) return "EXPIRE";

  const expected = Buffer.from(storedHash, "hex");
  const actual = Buffer.from(hashCode(customer.id, purpose, code.trim()), "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    await marketplacePrisma.marketplaceCustomer.update({
      where: { id: customer.id },
      data: { [f.attempts]: { increment: 1 } },
    });
    return "INVALIDE";
  }

  await marketplacePrisma.marketplaceCustomer.update({
    where: { id: customer.id },
    data: { ...onSuccess, [f.hash]: null, [f.expiresAt]: null, [f.attempts]: 0 },
  });
  return "OK";
}

export function checkVerificationCode(customer: MarketplaceCustomer, code: string): Promise<VerifyResult> {
  return consumeCode(customer, "verification", code, { emailVerifiedAt: new Date() });
}

// Réponse d'erreur commune aux écrans de saisie de code.
export function codeErrorResponse(result: Exclude<VerifyResult, "OK">, attemptsBefore: number) {
  if (result === "INVALIDE") {
    const remaining = VERIFICATION_MAX_ATTEMPTS - attemptsBefore - 1;
    const plural = remaining > 1 ? "s" : "";
    return NextResponse.json(
      {
        error:
          remaining > 0
            ? `Code incorrect. ${remaining} essai${plural} restant${plural}.`
            : "Code incorrect. Demandez un nouveau code.",
      },
      { status: 400 },
    );
  }
  if (result === "EXPIRE") {
    return NextResponse.json({ error: "Ce code a expiré. Demandez un nouveau code." }, { status: 400 });
  }
  return NextResponse.json({ error: "Trop d'essais. Demandez un nouveau code." }, { status: 429 });
}

// ---------------------------------------------------------------------------
// Verrouillage anti force brute, par compte et en base (vaut quel que soit
// le nombre d'instances serveur). Complété par une limite par IP en mémoire
// (lib/marketplace/rate-limit.ts) contre les essais sur de nombreux comptes.
// ---------------------------------------------------------------------------

export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_LOCK_MINUTES = 15;

export function minutesLocked(customer: MarketplaceCustomer): number {
  if (!customer.lockedUntil) return 0;
  const ms = customer.lockedUntil.getTime() - Date.now();
  return ms > 0 ? Math.ceil(ms / 60000) : 0;
}

export async function recordFailedLogin(customer: MarketplaceCustomer): Promise<void> {
  const failures = customer.failedLoginAttempts + 1;
  await marketplacePrisma.marketplaceCustomer.update({
    where: { id: customer.id },
    data:
      failures >= LOGIN_MAX_FAILURES
        ? { failedLoginAttempts: 0, lockedUntil: new Date(Date.now() + LOGIN_LOCK_MINUTES * 60000) }
        : { failedLoginAttempts: failures },
  });
}

export async function clearFailedLogins(customer: MarketplaceCustomer): Promise<void> {
  if (customer.failedLoginAttempts === 0 && !customer.lockedUntil) return;
  await marketplacePrisma.marketplaceCustomer.update({
    where: { id: customer.id },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });
}

export function lockedResponse(minutes: number) {
  const plural = minutes > 1 ? "s" : "";
  return NextResponse.json(
    {
      error: `Trop de tentatives de connexion. Réessayez dans ${minutes} minute${plural} ou réinitialisez votre mot de passe.`,
    },
    { status: 429 },
  );
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

// Après un changement de mot de passe : toutes les sessions ouvertes
// (autres appareils, éventuel intrus) sont révoquées.
export async function revokeAllSessions(customerId: string): Promise<void> {
  await marketplacePrisma.marketplaceSession.updateMany({
    where: { marketplaceCustomerId: customerId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export function unauthorized() {
  return NextResponse.json({ error: "Connectez-vous pour continuer." }, { status: 401 });
}

// IP du client. X-Real-IP d'abord : nginx (deploy/nginx) le fixe à
// $remote_addr, non falsifiable. X-Forwarded-For seulement en repli, et sa
// DERNIÈRE entrée (celle ajoutée par notre proxy) — la première peut être
// envoyée telle quelle par le client.
export function clientIp(request: Request): string | null {
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const forwarded = request.headers.get("x-forwarded-for");
  if (!forwarded) return null;
  const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean);
  return parts[parts.length - 1] ?? null;
}

export function requestIp(request: Request): string | null {
  return clientIp(request);
}

export async function sessionResponse(request: Request, customer: MarketplaceCustomer, status = 200) {
  const { token, expiresAt } = await createMarketplaceSession({
    customerId: customer.id,
    ip: requestIp(request),
    userAgent: request.headers.get("user-agent"),
  });
  return NextResponse.json({ token, expiresAt, customer: toPublicCustomer(customer) }, { status });
}
