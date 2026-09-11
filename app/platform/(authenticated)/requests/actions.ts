"use server";

import { revalidatePath } from "next/cache";

import { platformPrisma } from "@/lib/db/platform-client";
import { getPlatformAdminContext } from "@/lib/platform/context";

// Simple triage "vu/pas vu" — aucun envoi d'email dans ce projet (décision
// verrouillée), les demandes de contact sont traitées hors application par
// l'admin plateforme, cette bascule sert juste à ne pas les retraiter.
export async function markContactRequestHandled(formData: FormData): Promise<void> {
  await getPlatformAdminContext();

  const id = String(formData.get("id") ?? "");
  const traite = formData.get("traite") === "true";
  if (!id) return;

  await platformPrisma.contactRequest.update({
    where: { id },
    data: { traite },
  });

  revalidatePath("/platform/requests");
}
