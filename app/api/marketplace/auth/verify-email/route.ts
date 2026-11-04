import { NextResponse } from "next/server";

import { marketplacePrisma } from "@/lib/db/marketplace-client";
import {
  checkVerificationCode,
  normalizeEmail,
  sessionResponse,
  VERIFICATION_MAX_ATTEMPTS,
} from "@/lib/marketplace/auth";

// Validation de l'email par le code reçu — ouvre directement la session en
// cas de succès (pas de seconde saisie du mot de passe juste après
// l'inscription).
export async function POST(request: Request) {
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
  if (result === "INVALIDE") {
    const remaining = VERIFICATION_MAX_ATTEMPTS - customer.verificationAttempts - 1;
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
  if (result === "TROP_DE_TENTATIVES") {
    return NextResponse.json({ error: "Trop d'essais. Demandez un nouveau code." }, { status: 429 });
  }

  const verified = await marketplacePrisma.marketplaceCustomer.findUniqueOrThrow({ where: { id: customer.id } });
  return sessionResponse(request, verified);
}
