"use server";

import { revalidatePath } from "next/cache";

import { hashPassword } from "@/lib/auth/password";
import { platformPrisma } from "@/lib/db/platform-client";
import { getPlatformAdminContext } from "@/lib/platform/context";

export type CreatePlatformAdminState = { error: string | null };

export async function createPlatformAdmin(
  _prevState: CreatePlatformAdminState,
  formData: FormData,
): Promise<CreatePlatformAdminState> {
  await getPlatformAdminContext();

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || password.length < 8) {
    return { error: "Email et mot de passe (8 caractères minimum) sont requis." };
  }

  const existing = await platformPrisma.platformAdmin.findUnique({ where: { email } });
  if (existing) {
    return { error: "Un compte admin existe déjà avec cet email." };
  }

  const hash = await hashPassword(password);
  await platformPrisma.platformAdmin.create({ data: { email, hash } });

  revalidatePath("/platform/admins");
  return { error: null };
}

// Bascule actif/inactif plutôt qu'une suppression — même patron que
// Customer.actif/Shop.actif : un compte désactivé perd l'accès (vérifié à
// la connexion) sans qu'on perde la trace qu'il a existé.
export async function togglePlatformAdminActive(formData: FormData): Promise<void> {
  const ctx = await getPlatformAdminContext();

  const id = String(formData.get("id") ?? "");
  const actif = formData.get("actif") === "true";
  if (!id) return;

  // Un admin ne peut jamais se désactiver lui-même : personne d'autre ne
  // pourrait le réactiver s'il reste le seul compte actif. Déjà empêché
  // côté UI (bouton retiré sur sa propre ligne), revérifié ici.
  if (id === ctx.platformAdminId && !actif) return;

  await platformPrisma.platformAdmin.update({ where: { id }, data: { actif } });
  revalidatePath("/platform/admins");
}
