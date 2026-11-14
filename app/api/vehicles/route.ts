import { NextResponse } from "next/server";

import { recordAuditLog } from "@/lib/audit";
import { systemPrisma } from "@/lib/db/system-client";
import { withTenantContext } from "@/lib/db/tenant-context";
import { assertCapability } from "@/lib/permissions-server";
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";
import { organizationHasModule } from "@/lib/tenant/modules";
import { MAX_VEHICLE_IMAGES, parseVehicleForm, readVehicleImages } from "@/lib/vehicles/form";

// Route Handler plutôt que Server Action : une photo dépasse facilement le
// plafond de 1 Mo des Server Actions — même raison que /api/rentals/units.
export async function POST(request: Request) {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "vehicles:manage");
  const organization = await systemPrisma.organization.findUniqueOrThrow({ where: { id: ctx.organizationId } });
  if (!organizationHasModule(organization.enabledModules, "location_vehicules")) {
    return NextResponse.json({ error: "Le module Location de véhicules n'est pas activé." }, { status: 403 });
  }

  const formData = await request.formData();
  const parsed = parseVehicleForm(formData);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const images = await readVehicleImages(formData);
  if ("error" in images) return NextResponse.json({ error: images.error }, { status: 400 });
  if (images.payloads.length > MAX_VEHICLE_IMAGES) {
    return NextResponse.json({ error: `${MAX_VEHICLE_IMAGES} photos maximum par véhicule.` }, { status: 400 });
  }

  const shopId = await getActiveShopId(ctx.organizationId, ctx.userId);
  const { values } = parsed;

  const vehicle = await withTenantContext({ organizationId: ctx.organizationId, shopId }, async (tx) => {
    const created = await tx.vehicle.create({
      data: { organizationId: ctx.organizationId, shopId, ...values },
    });

    if (images.payloads.length > 0) {
      await tx.vehicleImage.createMany({
        data: images.payloads.map((payload, position) => ({
          vehicleId: created.id,
          organizationId: ctx.organizationId,
          shopId,
          position,
          ...payload,
        })),
      });
    }

    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "VEHICLE_CREATED",
      entite: "vehicle",
      entiteId: created.id,
      apres: values,
    });

    return created;
  });

  return NextResponse.json({ ok: true, id: vehicle.id });
}
