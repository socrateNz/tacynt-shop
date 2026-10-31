import { NextResponse } from "next/server";
import type { RentalUnitType } from "@prisma/client";

import { recordAuditLog } from "@/lib/audit";
import { withTenantContext } from "@/lib/db/tenant-context";
import { assertCapability } from "@/lib/permissions-server";
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES = 3;
const UNIT_TYPES: RentalUnitType[] = ["CHAMBRE", "STUDIO", "APPARTEMENT", "VILLA", "AUTRE"];

// Route Handler (pas Server Action) : même raison que POST /api/rentals/units
// — une nouvelle photo peut dépasser le plafond de 1 Mo des Server Actions.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ unitId: string }> },
) {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "location:manage");

  const { unitId } = await params;

  const formData = await request.formData();
  const type = String(formData.get("type") ?? "") as RentalUnitType;
  const designation = String(formData.get("designation") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const montantMensuel = Number(formData.get("montantMensuel") ?? 0);
  const dureeMinMois = Math.trunc(Number(formData.get("dureeMinMois") ?? 0));
  const commissionMontant = Number(formData.get("commissionMontant") ?? 0);
  const actif = formData.get("actif") === "on";
  const newImages = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  const removeImageIds = new Set(formData.getAll("removeImageIds").map(String));

  if (!UNIT_TYPES.includes(type) || !designation) {
    return NextResponse.json({ error: "Type et désignation requis." }, { status: 400 });
  }
  if (!Number.isFinite(montantMensuel) || montantMensuel <= 0) {
    return NextResponse.json({ error: "Loyer mensuel invalide." }, { status: 400 });
  }
  if (!Number.isFinite(dureeMinMois) || dureeMinMois < 1) {
    return NextResponse.json({ error: "Durée minimale invalide (au moins 1 mois)." }, { status: 400 });
  }
  if (!Number.isFinite(commissionMontant) || commissionMontant < 0) {
    return NextResponse.json({ error: "Commission invalide." }, { status: 400 });
  }
  for (const img of newImages) {
    if (img.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Image trop volumineuse (5 Mo max)." }, { status: 400 });
    }
  }
  const newImagePayloads = await Promise.all(
    newImages.map(async (img) => ({
      imageData: new Uint8Array(await img.arrayBuffer()),
      imageMimeType: img.type || "application/octet-stream",
    })),
  );

  const shopId = await getActiveShopId(ctx.organizationId, ctx.userId);

  try {
    await withTenantContext({ organizationId: ctx.organizationId, shopId }, async (tx) => {
      await tx.rentalUnit.findUniqueOrThrow({ where: { id: unitId } });

      await tx.rentalUnit.update({
        where: { id: unitId },
        data: { type, designation, description, montantMensuel, dureeMinMois, commissionMontant, actif },
      });

      const existingImages = await tx.rentalUnitImage.findMany({
        where: { rentalUnitId: unitId },
        select: { id: true, position: true },
      });
      const keptCount = existingImages.filter((img) => !removeImageIds.has(img.id)).length;
      if (keptCount + newImagePayloads.length > MAX_IMAGES) {
        throw new Error("TOO_MANY_IMAGES");
      }

      if (removeImageIds.size > 0) {
        // Même exception que product_images : une photo retirée se
        // supprime réellement, ce n'est pas un document métier.
        await tx.rentalUnitImage.deleteMany({
          where: { rentalUnitId: unitId, id: { in: [...removeImageIds] } },
        });
      }

      if (newImagePayloads.length > 0) {
        const nextPosition = existingImages.reduce((max, img) => Math.max(max, img.position), -1) + 1;
        await tx.rentalUnitImage.createMany({
          data: newImagePayloads.map((payload, i) => ({
            rentalUnitId: unitId,
            organizationId: ctx.organizationId,
            shopId,
            position: nextPosition + i,
            ...payload,
          })),
        });
      }

      await recordAuditLog(tx, {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: "RENTAL_UNIT_UPDATED",
        entite: "rental_unit",
        entiteId: unitId,
        apres: { designation, type, montantMensuel, dureeMinMois, commissionMontant, actif },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "TOO_MANY_IMAGES") {
      return NextResponse.json(
        { error: `${MAX_IMAGES} photos maximum par logement — supprimez-en avant d'en ajouter.` },
        { status: 400 },
      );
    }
    throw error;
  }

  return NextResponse.json({ ok: true });
}
