import { NextResponse } from "next/server";

import { marketplacePrisma } from "@/lib/db/marketplace-client";
import { normalizeEmail, secondsBeforeResend, sendVerificationCode } from "@/lib/marketplace/auth";
import { AUTH_RULES, rateLimit } from "@/lib/marketplace/rate-limit";

// Renvoi du code de validation, limité à un envoi par minute et par compte.
// Réponse identique que l'adresse existe ou non (hors délai d'attente) :
// cette route ne doit pas servir à tester quelles adresses ont un compte.
export async function POST(request: Request) {
  const limited = rateLimit(request, AUTH_RULES.code);
  if (limited) return limited;

  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  const email = normalizeEmail(String(body?.email ?? ""));
  const ok = NextResponse.json({ ok: true });

  const customer = email ? await marketplacePrisma.marketplaceCustomer.findUnique({ where: { email } }) : null;
  if (!customer || !customer.actif || customer.emailVerifiedAt) return ok;

  const wait = secondsBeforeResend(customer);
  if (wait > 0) {
    return NextResponse.json(
      { error: `Patientez ${wait} s avant de demander un nouveau code.`, retryAfter: wait },
      { status: 429 },
    );
  }

  try {
    await sendVerificationCode(customer);
  } catch (error) {
    console.error("Échec du renvoi du code de validation Sodu :", error);
    return NextResponse.json({ error: "L'email n'a pas pu être envoyé. Réessayez dans un instant." }, { status: 502 });
  }
  return ok;
}
