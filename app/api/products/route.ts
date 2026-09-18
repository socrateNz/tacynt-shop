import { NextResponse } from "next/server";

import { recordAuditLog } from "@/lib/audit";
import { withTenantContext } from "@/lib/db/tenant-context";
import { assertCapability } from "@/lib/permissions-server";
import { assertWithinQuota, QuotaExceededError } from "@/lib/quotas";
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
  const suiviStock = formData.get("suiviStock") === "on";
  const suiviLots = formData.get("suiviLots") === "on";
  const suiviSerie = formData.get("suiviSerie") === "on";
  const codeBarres = String(formData.get("codeBarres") ?? "").trim() || null;
  const prixAchatRef = Number(formData.get("prixAchatRef") ?? 0);
  const prixVente = Number(formData.get("prixVente") ?? 0);
  const prixPlancherRaw = String(formData.get("prixPlancher") ?? "").trim();
  const prixPlancher = prixPlancherRaw ? Number(prixPlancherRaw) : null;
  const seuilAlerteRaw = String(formData.get("seuilAlerte") ?? "").trim();
  const seuilAlerte = seuilAlerteRaw ? Number(seuilAlerteRaw) : null;
  const image = formData.get("image");

  if (!designation || !Number.isFinite(prixVente) || prixVente < 0) {
    return NextResponse.json(
      { error: "Désignation et prix de vente (valide) sont requis." },
      { status: 400 },
    );
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
          suiviStock,
          suiviLots,
          suiviSerie,
        },
      });

      // Catalogue simple (Phase 1) : chaque produit reçoit une variante par
      // défaut — stock/prix/code-barres s'accrochent toujours à une
      // variante, jamais directement au produit.
      const variant = await tx.productVariant.create({
        data: {
          organizationId: ctx.organizationId,
          productId: product.id,
          codeBarres,
          prixAchatRef,
        },
      });

      await tx.shopPrice.create({
        data: {
          organizationId: ctx.organizationId,
          variantId: variant.id,
          shopId,
          prixVente,
          prixPlancher,
          seuilAlerte,
        },
      });

      if (imageData) {
        await tx.productImage.create({
          data: { productId: product.id, organizationId: ctx.organizationId, imageData, imageMimeType },
        });
      }

      await recordAuditLog(tx, {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: "PRODUCT_CREATED",
        entite: "product",
        entiteId: product.id,
        apres: { reference, designation, prixVente },
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
