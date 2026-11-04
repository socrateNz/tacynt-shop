import { NextResponse } from "next/server";

import { marketplacePrisma } from "@/lib/db/marketplace-client";
import { EMAIL_RE, normalizeEmail, secondsBeforeResend, sendCode } from "@/lib/marketplace/auth";
import { AUTH_RULES, rateLimit } from "@/lib/marketplace/rate-limit";

// Mot de passe oublié, étape 1 : envoie un code de réinitialisation par
// email. Réponse identique que l'adresse ait un compte ou non — cette route
// ne doit pas servir à tester quelles adresses sont inscrites. Un envoi par
// minute au maximum par compte (au-delà, silencieusement ignoré pour la
// même raison).
export async function POST(request: Request) {
  const limited = rateLimit(request, AUTH_RULES.code);
  if (limited) return limited;

  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  const email = normalizeEmail(String(body?.email ?? ""));
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Adresse email invalide." }, { status: 400 });
  }

  const customer = await marketplacePrisma.marketplaceCustomer.findUnique({ where: { email } });
  if (customer?.actif && secondsBeforeResend(customer, "reset") === 0) {
    try {
      await sendCode(customer, "reset");
    } catch (error) {
      console.error("Échec de l'envoi du code de réinitialisation Sodu :", error);
      return NextResponse.json({ error: "L'email n'a pas pu être envoyé. Réessayez dans un instant." }, { status: 502 });
    }
  }

  return NextResponse.json({ ok: true, email });
}
