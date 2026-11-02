import { NextResponse } from "next/server";
import type { RentalUnitAmenity, RentalUnitType } from "@prisma/client";

import { recordAuditLog } from "@/lib/audit";
import { systemPrisma } from "@/lib/db/system-client";
import { withTenantContext } from "@/lib/db/tenant-context";
import { assertCapability } from "@/lib/permissions-server";
import { RENTAL_UNIT_AMENITIES } from "@/lib/rentals/types";
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";
import { organizationHasModule } from "@/lib/tenant/modules";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES = 3;
const UNIT_TYPES: RentalUnitType[] = ["CHAMBRE", "STUDIO", "APPARTEMENT", "VILLA", "AUTRE"];
const KNOWN_AMENITIES = new Set(RENTAL_UNIT_AMENITIES.map((a) => a.value));

function parseAmenities(formData: FormData): RentalUnitAmenity[] {
  // Filtré sur la liste connue plutôt que de planter sur une valeur
  // inattendue — même esprit que le reste de la validation ici (erreur 400
  // seulement sur ce qui est réellement invalide/dangereux).
  return formData
    .getAll("equipements")
    .map(String)
    .filter((v) => KNOWN_AMENITIES.has(v)) as RentalUnitAmenity[];
}

function parseOptionalInt(value: FormDataEntryValue | null): number | null {
  if (value === null || value === "") return null;
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) ? n : null;
}

// Route Handler plutôt que Server Action : une photo dépasse facilement le
// plafond de 1 Mo des Server Actions — même raison que /api/products.
export async function POST(request: Request) {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "location:manage");
  const organization = await systemPrisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
  });
  if (!organizationHasModule(organization.enabledModules, "location")) {
    return NextResponse.json({ error: "Le module Location n'est pas activé." }, { status: 403 });
  }

  const formData = await request.formData();
  const type = String(formData.get("type") ?? "") as RentalUnitType;
  const designation = String(formData.get("designation") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const montantMensuel = Number(formData.get("montantMensuel") ?? 0);
  const dureeMinMois = Math.trunc(Number(formData.get("dureeMinMois") ?? 0));
  const commissionMontant = Number(formData.get("commissionMontant") ?? 0);
  const localityId = String(formData.get("localityId") ?? "").trim() || null;
  const surfaceM2 = parseOptionalInt(formData.get("surfaceM2"));
  const nombrePieces = parseOptionalInt(formData.get("nombrePieces"));
  const equipements = parseAmenities(formData);
  const images = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);

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
  if (surfaceM2 !== null && surfaceM2 < 0) {
    return NextResponse.json({ error: "Surface invalide." }, { status: 400 });
  }
  if (nombrePieces !== null && nombrePieces < 0) {
    return NextResponse.json({ error: "Nombre de pièces invalide." }, { status: 400 });
  }
  if (images.length > MAX_IMAGES) {
    return NextResponse.json({ error: `${MAX_IMAGES} photos maximum par logement.` }, { status: 400 });
  }
  for (const img of images) {
    if (img.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Image trop volumineuse (5 Mo max)." }, { status: 400 });
    }
  }
  const imagePayloads = await Promise.all(
    images.map(async (img) => ({
      imageData: new Uint8Array(await img.arrayBuffer()),
      imageMimeType: img.type || "application/octet-stream",
    })),
  );

  const shopId = await getActiveShopId(ctx.organizationId, ctx.userId);

  const unit = await withTenantContext({ organizationId: ctx.organizationId, shopId }, async (tx) => {
    const created = await tx.rentalUnit.create({
      data: {
        organizationId: ctx.organizationId,
        shopId,
        type,
        designation,
        description,
        montantMensuel,
        dureeMinMois,
        commissionMontant,
        localityId,
        surfaceM2,
        nombrePieces,
        equipements,
      },
    });

    if (imagePayloads.length > 0) {
      await tx.rentalUnitImage.createMany({
        data: imagePayloads.map((payload, position) => ({
          rentalUnitId: created.id,
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
      action: "RENTAL_UNIT_CREATED",
      entite: "rental_unit",
      entiteId: created.id,
      apres: {
        designation,
        type,
        montantMensuel,
        dureeMinMois,
        commissionMontant,
        localityId,
        surfaceM2,
        nombrePieces,
        equipements,
      },
    });

    return created;
  });

  return NextResponse.json({ ok: true, id: unit.id });
}
