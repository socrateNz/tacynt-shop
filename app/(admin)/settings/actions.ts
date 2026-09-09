"use server";

import { revalidatePath } from "next/cache";

import { recordAuditLog } from "@/lib/audit";
import { withTenantContext } from "@/lib/db/tenant-context";
import { assertCapability } from "@/lib/permissions";
import { PROFILES } from "@/lib/tenant/profile";
import { getTenantContext } from "@/lib/tenant/context";

export type SettingsFormState = { error: string | null };

export async function updateProfilMetier(
  _prevState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "shops:manage");

  const profilMetier = String(formData.get("profilMetier") ?? "");
  if (!PROFILES.some((p) => p.value === profilMetier)) {
    return { error: "Profil métier invalide." };
  }

  await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
    await tx.organization.update({
      where: { id: ctx.organizationId },
      data: { profilMetier },
    });

    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "PROFIL_METIER_UPDATED",
      entite: "organization",
      entiteId: ctx.organizationId,
      apres: { profilMetier },
    });
  });

  revalidatePath("/settings");
  return { error: null };
}
