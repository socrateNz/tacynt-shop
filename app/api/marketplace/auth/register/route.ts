import { NextResponse } from "next/server";

import { hashPassword } from "@/lib/auth/password";
import { marketplacePrisma } from "@/lib/db/marketplace-client";
import {
  EMAIL_RE,
  normalizeEmail,
  normalizePhone,
  PASSWORD_MIN_LENGTH,
  secondsBeforeResend,
  sendVerificationCode,
} from "@/lib/marketplace/auth";

// Inscription client Sodu. Aucune session ici : le compte n'est utilisable
// qu'après validation de l'email (code envoyé, puis
// /api/marketplace/auth/verify-email). Un compte existant mais jamais
// validé est simplement mis à jour (faute de frappe, mot de passe oublié
// avant validation) plutôt que de bloquer l'adresse indéfiniment.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    nom?: string;
    email?: string;
    telephone?: string;
    password?: string;
  } | null;

  const nom = String(body?.nom ?? "").trim();
  const email = normalizeEmail(String(body?.email ?? ""));
  const telephone = normalizePhone(String(body?.telephone ?? ""));
  const password = String(body?.password ?? "");

  if (!nom) {
    return NextResponse.json({ error: "Votre nom est requis." }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Adresse email invalide." }, { status: 400 });
  }
  if (telephone.replace("+", "").length < 8) {
    return NextResponse.json({ error: "Numéro de téléphone invalide." }, { status: 400 });
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return NextResponse.json(
      { error: `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.` },
      { status: 400 },
    );
  }

  const existing = await marketplacePrisma.marketplaceCustomer.findUnique({ where: { email } });
  if (existing?.emailVerifiedAt) {
    return NextResponse.json(
      { error: "Un compte existe déjà avec cette adresse email. Connectez-vous." },
      { status: 409 },
    );
  }

  const hash = await hashPassword(password);
  let customer;
  try {
    customer = existing
      ? await marketplacePrisma.marketplaceCustomer.update({
          where: { id: existing.id },
          data: { nom, telephone, hash },
        })
      : await marketplacePrisma.marketplaceCustomer.create({ data: { nom, email, telephone, hash } });
  } catch (error) {
    // Course entre deux inscriptions simultanées sur la même adresse.
    if (typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Un compte existe déjà avec cette adresse email." }, { status: 409 });
    }
    throw error;
  }

  // Réinscription immédiate : le code déjà envoyé reste valable, inutile
  // d'en renvoyer un (et d'inonder la boîte mail).
  if (secondsBeforeResend(customer) === 0) {
    try {
      await sendVerificationCode(customer);
    } catch (error) {
      console.error("Échec de l'envoi du code de validation Sodu :", error);
      return NextResponse.json(
        { error: "Compte créé, mais l'email de validation n'a pas pu être envoyé. Réessayez dans un instant." },
        { status: 502 },
      );
    }
  }

  return NextResponse.json({ pendingVerification: true, email }, { status: 201 });
}
