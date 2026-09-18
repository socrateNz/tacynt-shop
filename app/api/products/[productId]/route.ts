import { NextResponse } from "next/server";

import { recordAuditLog } from "@/lib/audit";
import { withTenantContext } from "@/lib/db/tenant-context";
import { assertCapability } from "@/lib/permissions-server";
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES = 3;

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

// Route Handler (pas Server Action) pour la même raison que POST
// /api/products : une nouvelle photo peut dépasser le plafond de 1 Mo des
// Server Actions. Modifie le produit, sa variante par défaut (Phase 1/2 :
// un produit créé depuis ce formulaire n'en a toujours qu'une) et le prix
// de la boutique active — jamais suiviStock/suiviLots/suiviSerie ni le prix
// d'achat de référence ici, trop risqué de les rouvrir après coup une fois
// des mouvements de stock déjà enregistrés dessus.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ productId: string }> },
) {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "catalog:write");

  const { productId } = await params;

  const formData = await request.formData();
  const designation = String(formData.get("designation") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "") || null;
  const unite = String(formData.get("unite") ?? "piece").trim() || "piece";
  const tauxTaxe = Number(formData.get("tauxTaxe") ?? 0);
  const codeBarres = String(formData.get("codeBarres") ?? "").trim() || null;
  const prixVente = Number(formData.get("prixVente") ?? 0);
  const prixPlancherRaw = String(formData.get("prixPlancher") ?? "").trim();
  const prixPlancher = prixPlancherRaw ? Number(prixPlancherRaw) : null;
  const seuilAlerteRaw = String(formData.get("seuilAlerte") ?? "").trim();
  const seuilAlerte = seuilAlerteRaw ? Number(seuilAlerteRaw) : null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const newImages = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  const removeImageIds = new Set(formData.getAll("removeImageIds").map(String));

  if (!designation || !Number.isFinite(prixVente) || prixVente < 0) {
    return NextResponse.json(
      { error: "Désignation et prix de vente (valide) sont requis." },
      { status: 400 },
    );
  }
  if (!Number.isFinite(tauxTaxe) || tauxTaxe < 0) {
    return NextResponse.json({ error: "Taux de taxe invalide." }, { status: 400 });
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
      const product = await tx.product.findUniqueOrThrow({
        where: { id: productId },
        include: { variants: true },
      });
      const variant = product.variants[0];
      if (!variant) throw new Error("PRODUCT_HAS_NO_VARIANT");

      await tx.product.update({
        where: { id: productId },
        data: { designation, categoryId, unite, tauxTaxe, description },
      });

      await tx.productVariant.update({
        where: { id: variant.id },
        data: { codeBarres },
      });

      await tx.shopPrice.upsert({
        where: { variantId_shopId: { variantId: variant.id, shopId } },
        create: {
          organizationId: ctx.organizationId,
          variantId: variant.id,
          shopId,
          prixVente,
          prixPlancher,
          seuilAlerte,
        },
        update: { prixVente, prixPlancher, seuilAlerte },
      });

      const existingImages = await tx.productImage.findMany({
        where: { productId },
        select: { id: true, position: true },
      });
      const keptCount = existingImages.filter((img) => !removeImageIds.has(img.id)).length;
      if (keptCount + newImagePayloads.length > MAX_IMAGES) {
        throw new Error("TOO_MANY_IMAGES");
      }

      if (removeImageIds.size > 0) {
        // Lignes supprimées plutôt que vidées : products/page.tsx et
        // getStorefrontCatalog détectent "a une photo" par la seule
        // existence de lignes product_images (jamais en relisant
        // imageData, pour ne pas alourdir ces requêtes de liste).
        await tx.productImage.deleteMany({
          where: { productId, id: { in: [...removeImageIds] } },
        });
      }

      if (newImagePayloads.length > 0) {
        // Nouvelles positions après le plus haut indice existant — jamais
        // besoin de réindexer les images conservées, position n'est qu'un
        // indice de tri, pas une contrainte d'unicité (voir schema.prisma).
        const nextPosition = existingImages.reduce((max, img) => Math.max(max, img.position), -1) + 1;
        await tx.productImage.createMany({
          data: newImagePayloads.map((payload, i) => ({
            productId,
            organizationId: ctx.organizationId,
            position: nextPosition + i,
            ...payload,
          })),
        });
      }

      await recordAuditLog(tx, {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: "PRODUCT_UPDATED",
        entite: "product",
        entiteId: productId,
        apres: { designation, categoryId, unite, tauxTaxe, codeBarres, prixVente },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "TOO_MANY_IMAGES") {
      return NextResponse.json(
        { error: `${MAX_IMAGES} photos maximum par produit — supprimez-en avant d'en ajouter.` },
        { status: 400 },
      );
    }
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: "Ce code-barres existe déjà, ou une erreur temporaire est survenue — réessayez." },
        { status: 400 },
      );
    }
    throw error;
  }

  return NextResponse.json({ ok: true });
}
