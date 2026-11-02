"use server";

import { revalidatePath } from "next/cache";

import { recordAuditLog } from "@/lib/audit";
import { withTenantContext } from "@/lib/db/tenant-context";
import { assertCapability } from "@/lib/permissions-server";
import { getTenantContext } from "@/lib/tenant/context";

export async function createRentalLocality(formData: FormData) {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "location:manage");

  const nom = String(formData.get("nom") ?? "").trim();
  const parentId = String(formData.get("parentId") ?? "") || null;

  if (!nom) {
    throw new Error("Le nom est requis.");
  }

  await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
    if (parentId) {
      const parent = await tx.rentalLocality.findUniqueOrThrow({ where: { id: parentId } });
      // Jamais plus de 2 niveaux (Ville -> Quartier) : un quartier ne peut
      // pas lui-même devenir parent.
      if (parent.parentId) {
        throw new Error("Une ville/quartier parente ne peut pas déjà avoir son propre parent.");
      }
    }

    const locality = await tx.rentalLocality.create({
      data: { organizationId: ctx.organizationId, nom, parentId },
    });

    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "RENTAL_LOCALITY_CREATED",
      entite: "rental_locality",
      entiteId: locality.id,
      apres: { nom, parentId },
    });
  });

  revalidatePath("/rentals/localities");
}
