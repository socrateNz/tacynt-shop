import { NextResponse } from "next/server";

import { recordAuditLog } from "@/lib/audit";
import { withTenantContext } from "@/lib/db/tenant-context";
import { assertCapability } from "@/lib/permissions-server";
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";
import { MAX_VEHICLE_IMAGES, parseVehicleForm, readVehicleImages } from "@/lib/vehicles/form";

// Modification d'un véhicule (Route Handler : photos > 1 Mo, voir POST
// /api/vehicles).
export async function POST(request: Request, { params }: { params: Promise<{ vehicleId: string }> }) {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "vehicles:manage");
  const { vehicleId } = await params;

  const formData = await request.formData();
  const parsed = parseVehicleForm(formData);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const images = await readVehicleImages(formData);
  if ("error" in images) return NextResponse.json({ error: images.error }, { status: 400 });
  const actif = formData.get("actif") === "on";
  const removeImageIds = new Set(formData.getAll("removeImageIds").map(String));

  const shopId = await getActiveShopId(ctx.organizationId, ctx.userId);
  const { values } = parsed;

  try {
    await withTenantContext({ organizationId: ctx.organizationId, shopId }, async (tx) => {
      // RLS : un véhicule d'une autre boutique/organisation est introuvable.
      await tx.vehicle.findUniqueOrThrow({ where: { id: vehicleId } });
      await tx.vehicle.update({ where: { id: vehicleId }, data: { ...values, actif } });

      const existing = await tx.vehicleImage.findMany({
        where: { vehicleId },
        select: { id: true, position: true },
      });
      const kept = existing.filter((img) => !removeImageIds.has(img.id)).length;
      if (kept + images.payloads.length > MAX_VEHICLE_IMAGES) throw new Error("TOO_MANY_IMAGES");

      if (removeImageIds.size > 0) {
        // Une photo retirée se supprime réellement (pas un document métier).
        await tx.vehicleImage.deleteMany({ where: { vehicleId, id: { in: [...removeImageIds] } } });
      }
      if (images.payloads.length > 0) {
        const next = existing.reduce((max, img) => Math.max(max, img.position), -1) + 1;
        await tx.vehicleImage.createMany({
          data: images.payloads.map((payload, i) => ({
            vehicleId,
            organizationId: ctx.organizationId,
            shopId,
            position: next + i,
            ...payload,
          })),
        });
      }

      await recordAuditLog(tx, {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: "VEHICLE_UPDATED",
        entite: "vehicle",
        entiteId: vehicleId,
        apres: { ...values, actif },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "TOO_MANY_IMAGES") {
      return NextResponse.json(
        { error: `${MAX_VEHICLE_IMAGES} photos maximum par véhicule — supprimez-en avant d'en ajouter.` },
        { status: 400 },
      );
    }
    throw error;
  }

  return NextResponse.json({ ok: true });
}
