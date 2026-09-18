import { NextResponse } from "next/server";

import { recordAuditLog } from "@/lib/audit";
import { withTenantContext } from "@/lib/db/tenant-context";
import { assertCapability } from "@/lib/permissions-server";
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

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
  const image = formData.get("image");
  const removeImage = formData.get("removeImage") === "on";

  if (!designation || !Number.isFinite(prixVente) || prixVente < 0) {
    return NextResponse.json(
      { error: "Désignation et prix de vente (valide) sont requis." },
      { status: 400 },
    );
  }
  if (!Number.isFinite(tauxTaxe) || tauxTaxe < 0) {
    return NextResponse.json({ error: "Taux de taxe invalide." }, { status: 400 });
  }

  let imageData: Uint8Array<ArrayBuffer> | null = null;
  let imageMimeType: string | null = null;
  if (image instanceof File && image.size > 0) {
    if (image.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Image trop volumineuse (5 Mo max)." }, { status: 400 });
    }
    imageData = new Uint8Array(await image.arrayBuffer());
    imageMimeType = image.type || "application/octet-stream";
  }

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
        data: { designation, categoryId, unite, tauxTaxe },
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

      if (imageData) {
        await tx.productImage.upsert({
          where: { productId },
          create: { productId, organizationId: ctx.organizationId, imageData, imageMimeType },
          update: { imageData, imageMimeType },
        });
      } else if (removeImage) {
        // Ligne supprimée plutôt que vidée : products/page.tsx et
        // getStorefrontCatalog détectent "a une photo" par la seule
        // existence de la relation image (jamais en relisant imageData,
        // pour ne pas alourdir ces requêtes de liste) — une ligne à données
        // nulles serait donc encore comptée comme "a une photo" (bug réel
        // constaté).
        await tx.productImage.deleteMany({ where: { productId } });
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
