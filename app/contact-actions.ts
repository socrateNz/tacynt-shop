"use server";

import { platformPrisma } from "@/lib/db/platform-client";

export type ContactFormState = { error: string | null; success: boolean };

// Formulaire public de la landing page (app/page.tsx) — visiteur anonyme,
// aucun contexte tenant. platformPrisma (pas systemPrisma/tenant) : même
// client que les autres tables platform-only (voir prisma/schema.prisma,
// modèle ContactRequest). Aucun envoi d'email — stocké pour consultation
// par l'admin plateforme (/platform/requests), décision verrouillée.
export async function submitContactRequest(
  _prevState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const nom = String(formData.get("nom") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const message = String(formData.get("message") ?? "").trim();

  if (!nom || !email || !message) {
    return { error: "Nom, email et message sont requis.", success: false };
  }

  await platformPrisma.contactRequest.create({ data: { nom, email, message } });

  return { error: null, success: true };
}
