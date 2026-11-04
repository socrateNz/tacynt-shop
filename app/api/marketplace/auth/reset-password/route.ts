import { NextResponse } from "next/server";

import { hashPassword } from "@/lib/auth/password";
import { marketplacePrisma } from "@/lib/db/marketplace-client";
import {
  codeErrorResponse,
  consumeCode,
  normalizeEmail,
  PASSWORD_MIN_LENGTH,
  revokeAllSessions,
  sessionResponse,
} from "@/lib/marketplace/auth";
import { AUTH_RULES, rateLimit } from "@/lib/marketplace/rate-limit";

// Mot de passe oublié, étape 2 : code reçu + nouveau mot de passe. En cas
// de succès : nouveau mot de passe, déverrouillage, email considéré comme
// validé (recevoir le code prouve l'accès à la boîte mail), TOUTES les
// sessions existantes révoquées, puis nouvelle session pour cet appareil.
export async function POST(request: Request) {
  const limited = rateLimit(request, AUTH_RULES.code);
  if (limited) return limited;

  const body = (await request.json().catch(() => null)) as {
    email?: string;
    code?: string;
    password?: string;
  } | null;
  const email = normalizeEmail(String(body?.email ?? ""));
  const code = String(body?.code ?? "").replace(/\s/g, "");
  const password = String(body?.password ?? "");

  if (!email || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Saisissez le code à 6 chiffres reçu par email." }, { status: 400 });
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return NextResponse.json(
      { error: `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.` },
      { status: 400 },
    );
  }

  const customer = await marketplacePrisma.marketplaceCustomer.findUnique({ where: { email } });
  if (!customer || !customer.actif) {
    return NextResponse.json({ error: "Code invalide." }, { status: 400 });
  }

  const result = await consumeCode(customer, "reset", code, {
    hash: await hashPassword(password),
    failedLoginAttempts: 0,
    lockedUntil: null,
    emailVerifiedAt: customer.emailVerifiedAt ?? new Date(),
  });
  if (result !== "OK") return codeErrorResponse(result, customer.resetAttempts);

  await revokeAllSessions(customer.id);
  const updated = await marketplacePrisma.marketplaceCustomer.findUniqueOrThrow({ where: { id: customer.id } });
  return sessionResponse(request, updated);
}
