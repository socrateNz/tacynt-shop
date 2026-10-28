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
// Server Actions. Même structure que ce POST de création (product-form.tsx
// / product-edit-dialog.tsx partagent le même patron variantsJson) : ce
// dialogue n'est plus scopé à variants[0] seul, il gère toutes les
// variantes du produit, exactement comme à la création.
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
  const tauxTaxe = Number(formData.get("tauxTaxe") ?? 0);
  const prixEmballageRaw = String(formData.get("prixEmballage") ?? "").trim();
  const prixEmballage = prixEmballageRaw ? Number(prixEmballageRaw) : null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const suiviStock = formData.get("suiviStock") === "on";
  const suiviLots = formData.get("suiviLots") === "on";
  const suiviSerie = formData.get("suiviSerie") === "on";
  const newImages = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  const removeImageIds = new Set(formData.getAll("removeImageIds").map(String));

  // Jamais fait confiance qu'à ce qui est revalidé ligne par ligne, jamais à
  // la seule validation côté client — même principe que POST /api/products.
  type VariantInput = {
    variantId?: string | null;
    attributs?: Record<string, string>;
    codeBarres?: string | null;
    prixAchatRef?: number;
    unite?: string;
    uniteQuantite?: number;
    prixVente: number;
    prixPlancher?: number | null;
    seuilAlerte?: number | null;
  };
  let variantInputs: VariantInput[];
  try {
    const parsed = JSON.parse(String(formData.get("variantsJson") ?? "[]"));
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("empty");
    variantInputs = parsed;
  } catch {
    return NextResponse.json({ error: "Au moins une variante valide est requise." }, { status: 400 });
  }
  let deactivatedVariantIds: string[];
  try {
    const parsed = JSON.parse(String(formData.get("deactivatedVariantIdsJson") ?? "[]"));
    deactivatedVariantIds = Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    deactivatedVariantIds = [];
  }

  if (!designation) {
    return NextResponse.json({ error: "Désignation requise." }, { status: 400 });
  }
  if (!Number.isFinite(tauxTaxe) || tauxTaxe < 0) {
    return NextResponse.json({ error: "Taux de taxe invalide." }, { status: 400 });
  }
  if (prixEmballage !== null && (!Number.isFinite(prixEmballage) || prixEmballage < 0)) {
    return NextResponse.json({ error: "Prix d'emballage invalide." }, { status: 400 });
  }
  if (
    variantInputs.some(
      (v) => typeof v.prixVente !== "number" || !Number.isFinite(v.prixVente) || v.prixVente < 0,
    )
  ) {
    return NextResponse.json(
      { error: "Chaque variante doit avoir un prix de vente (valide) requis." },
      { status: 400 },
    );
  }
  if (
    variantInputs.some(
      (v) =>
        v.uniteQuantite !== undefined &&
        (typeof v.uniteQuantite !== "number" || !Number.isFinite(v.uniteQuantite) || v.uniteQuantite < 0),
    )
  ) {
    return NextResponse.json(
      { error: "Chaque variante doit avoir une quantité d'unité valide." },
      { status: 400 },
    );
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
      const existingVariantIds = new Set(product.variants.map((v) => v.id));

      // Les id transmis doivent appartenir à CE produit — jamais faire
      // confiance à un variantId arbitraire envoyé par le client.
      for (const v of variantInputs) {
        if (v.variantId && !existingVariantIds.has(v.variantId)) {
          throw new Error("VARIANT_NOT_FOUND");
        }
      }
      for (const id of deactivatedVariantIds) {
        if (!existingVariantIds.has(id)) throw new Error("VARIANT_NOT_FOUND");
      }

      await tx.product.update({
        where: { id: productId },
        data: { designation, categoryId, tauxTaxe, prixEmballage, description, suiviStock, suiviLots, suiviSerie },
      });

      for (const v of variantInputs) {
        if (v.variantId) {
          await tx.productVariant.update({
            where: { id: v.variantId },
            data: {
              attributs: v.attributs ?? {},
              codeBarres: v.codeBarres?.trim() || null,
              prixAchatRef: v.prixAchatRef ?? 0,
              unite: v.unite?.trim() || "piece",
              uniteQuantite: v.uniteQuantite ?? 1,
            },
          });
          await tx.shopPrice.upsert({
            where: { variantId_shopId: { variantId: v.variantId, shopId } },
            create: {
              organizationId: ctx.organizationId,
              variantId: v.variantId,
              shopId,
              prixVente: v.prixVente,
              prixPlancher: v.prixPlancher ?? null,
              seuilAlerte: v.seuilAlerte ?? null,
            },
            update: { prixVente: v.prixVente, prixPlancher: v.prixPlancher ?? null, seuilAlerte: v.seuilAlerte ?? null },
          });
        } else {
          const variant = await tx.productVariant.create({
            data: {
              organizationId: ctx.organizationId,
              productId,
              attributs: v.attributs ?? {},
              codeBarres: v.codeBarres?.trim() || null,
              prixAchatRef: v.prixAchatRef ?? 0,
              unite: v.unite?.trim() || "piece",
              uniteQuantite: v.uniteQuantite ?? 1,
            },
          });
          await tx.shopPrice.create({
            data: {
              organizationId: ctx.organizationId,
              variantId: variant.id,
              shopId,
              prixVente: v.prixVente,
              prixPlancher: v.prixPlancher ?? null,
              seuilAlerte: v.seuilAlerte ?? null,
            },
          });
        }
      }

      // Jamais de suppression physique (mouvements/lignes de vente déjà
      // rattachés) — même règle que deactivateVariant.
      for (const id of deactivatedVariantIds) {
        await tx.productVariant.update({ where: { id }, data: { actif: false } });
      }

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
        apres: {
          designation,
          categoryId,
          tauxTaxe,
          prixEmballage,
          suiviStock,
          suiviLots,
          suiviSerie,
          variantsCount: variantInputs.length,
          deactivatedVariantsCount: deactivatedVariantIds.length,
        },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "TOO_MANY_IMAGES") {
      return NextResponse.json(
        { error: `${MAX_IMAGES} photos maximum par produit — supprimez-en avant d'en ajouter.` },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message === "VARIANT_NOT_FOUND") {
      return NextResponse.json(
        { error: "Une variante référencée n'appartient pas à ce produit." },
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
