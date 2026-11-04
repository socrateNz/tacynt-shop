import { NextResponse } from "next/server";

import { verifyPassword } from "@/lib/auth/password";
import { marketplacePrisma } from "@/lib/db/marketplace-client";
import { normalizeEmail, secondsBeforeResend, sendVerificationCode, sessionResponse } from "@/lib/marketplace/auth";

// Connexion par email + mot de passe uniquement. Même message pour un email
// inconnu et un mauvais mot de passe : ne jamais révéler si un compte
// existe. L'état "email non validé" n'est révélé qu'APRÈS un mot de passe
// correct — un nouveau code est alors envoyé automatiquement.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string; password?: string } | null;
  const email = normalizeEmail(String(body?.email ?? ""));
  const password = String(body?.password ?? "");

  if (!email || !password) {
    return NextResponse.json({ error: "Email et mot de passe requis." }, { status: 400 });
  }

  const customer = await marketplacePrisma.marketplaceCustomer.findUnique({ where: { email } });
  const valid = customer?.actif ? await verifyPassword(customer.hash, password) : false;
  if (!customer || !valid) {
    return NextResponse.json({ error: "Email ou mot de passe incorrect." }, { status: 401 });
  }

  if (!customer.emailVerifiedAt) {
    if (secondsBeforeResend(customer) === 0) {
      await sendVerificationCode(customer).catch((error: unknown) => {
        console.error("Échec de l'envoi du code de validation Sodu :", error);
      });
    }
    return NextResponse.json(
      { error: "Validez votre adresse email pour vous connecter.", code: "EMAIL_NON_VERIFIE", email },
      { status: 403 },
    );
  }

  return sessionResponse(request, customer);
}
