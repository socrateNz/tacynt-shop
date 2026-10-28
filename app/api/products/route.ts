import { NextResponse } from "next/server";

import { recordAuditLog } from "@/lib/audit";
import { withTenantContext } from "@/lib/db/tenant-context";
import { assertCapability } from "@/lib/permissions-server";
import { assertWithinQuota, QuotaExceededError } from "@/lib/quotas";
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

// Route Handler plutôt que Server Action : une photo produit dépasse
// facilement le plafond de 1 Mo des Server Actions (même raison que
// l'import catalogue, le justificatif de dépense et le logo).
export async function POST(request: Request) {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "catalog:write");

  const formData = await request.formData();
  const designation = String(formData.get("designation") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "") || null;
  const unite = String(formData.get("unite") ?? "piece").trim() || "piece";
  const tauxTaxe = Number(formData.get("tauxTaxe") ?? 0);
  const prixEmballageRaw = String(formData.get("prixEmballage") ?? "").trim();
  const prixEmballage = prixEmballageRaw ? Number(prixEmballageRaw) : null;
  const suiviStock = formData.get("suiviStock") === "on";
  const suiviLots = formData.get("suiviLots") === "on";
  const suiviSerie = formData.get("suiviSerie") === "on";
  const description = String(formData.get("description") ?? "").trim() || null;
  const images = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);

  // Au moins 1 variante par produit, chacune porte son propre code-barres/
  // prix d'achat/prix de vente — jamais directement sur Product (voir
  // schema.prisma). Le client (product-form.tsx) sérialise la liste en JSON
  // plutôt qu'en champs positionnels, pour un nombre de variantes/attributs
  // variable sans parsing fragile ; ici on ne fait confiance qu'à ce qui est
  // revalidé ligne par ligne, jamais à la validation côté client seule.
  type VariantInput = {
    attributs?: Record<string, string>;
    codeBarres?: string | null;
    prixAchatRef?: number;
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

  if (!designation) {
    return NextResponse.json({ error: "Désignation requise." }, { status: 400 });
  }
  if (prixEmballage !== null && (!Number.isFinite(prixEmballage) || prixEmballage < 0)) {
    return NextResponse.json({ error: "Prix d'emballage invalide." }, { status: 400 });
  }
  if (images.length > MAX_IMAGES) {
    return NextResponse.json(
      { error: `${MAX_IMAGES} photos maximum par produit.` },
      { status: 400 },
    );
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

  try {
    await withTenantContext({ organizationId: ctx.organizationId, shopId }, async (tx) => {
      const organization = await tx.organization.findUniqueOrThrow({
        where: { id: ctx.organizationId },
      });
      await assertWithinQuota(tx, ctx.organizationId, organization.plan, "products");

      // Référence auto-générée (même patron que les numéros de transfert,
      // bon de commande, réception...) : plus de saisie manuelle, jamais de
      // doublon à gérer côté utilisateur.
      const count = await tx.product.count({ where: { organizationId: ctx.organizationId } });
      const reference = `REF-${String(count + 1).padStart(6, "0")}`;

      const product = await tx.product.create({
        data: {
          organizationId: ctx.organizationId,
          reference,
          designation,
          categoryId,
          unite,
          tauxTaxe,
          prixEmballage,
          suiviStock,
          suiviLots,
          suiviSerie,
          description,
        },
      });

      // Chaque produit reçoit au moins une variante — stock/prix/code-barres
      // s'accrochent toujours à une variante, jamais directement au produit
      // (voir schema.prisma). Plusieurs variantes peuvent être créées en une
      // seule fois depuis ce formulaire (tailles, couleurs...).
      for (const v of variantInputs) {
        const variant = await tx.productVariant.create({
          data: {
            organizationId: ctx.organizationId,
            productId: product.id,
            attributs: v.attributs ?? {},
            codeBarres: v.codeBarres?.trim() || null,
            prixAchatRef: v.prixAchatRef ?? 0,
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

      if (imagePayloads.length > 0) {
        await tx.productImage.createMany({
          data: imagePayloads.map((payload, position) => ({
            productId: product.id,
            organizationId: ctx.organizationId,
            position,
            ...payload,
          })),
        });
      }

      await recordAuditLog(tx, {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: "PRODUCT_CREATED",
        entite: "product",
        entiteId: product.id,
        apres: { reference, designation, variantsCount: variantInputs.length },
      });

      return product;
    });
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
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
