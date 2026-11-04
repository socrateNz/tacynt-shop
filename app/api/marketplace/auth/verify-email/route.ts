import { NextResponse } from "next/server";

import { marketplacePrisma } from "@/lib/db/marketplace-client";
import { checkVerificationCode, codeErrorResponse, normalizeEmail, sessionResponse } from "@/lib/marketplace/auth";
import { AUTH_RULES, rateLimit } from "@/lib/marketplace/rate-limit";

// Validation de l'email par le code reçu — ouvre directement la session en
// cas de succès (pas de seconde saisie du mot de passe juste après
// l'inscription).
export async function POST(request: Request) {
  const limited = rateLimit(request, AUTH_RULES.code);
  if (limited) return limited;

  const body = (await request.json().catch(() => null)) as { email?: string; code?: string } | null;
  const email = normalizeEmail(String(body?.email ?? ""));
  const code = String(body?.code ?? "").replace(/\s/g, "");

  if (!email || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Saisissez le code à 6 chiffres reçu par email." }, { status: 400 });
  }

  const customer = await marketplacePrisma.marketplaceCustomer.findUnique({ where: { email } });
  if (!customer || !customer.actif) {
    return NextResponse.json({ error: "Code invalide." }, { status: 400 });
  }
  if (customer.emailVerifiedAt) {
    return NextResponse.json({ error: "Cette adresse est déjà validée. Connectez-vous." }, { status: 409 });
  }

  const result = await checkVerificationCode(customer, code);
  if (result !== "OK") return codeErrorResponse(result, customer.verificationAttempts);

  const verified = await marketplacePrisma.marketplaceCustomer.findUniqueOrThrow({ where: { id: customer.id } });
  return sessionResponse(request, verified);
}
