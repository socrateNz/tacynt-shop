import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { recordAuditLog } from "@/lib/audit";
import type { ImportRow } from "@/lib/catalog/import";
import { revalidateRows } from "@/lib/catalog/import";
import { withTenantContext } from "@/lib/db/tenant-context";
import { assertCapability } from "@/lib/permissions";
import { assertWithinQuota, QuotaExceededError } from "@/lib/quotas";
import { creditStock } from "@/lib/stock/movements";
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";

type SkippedRow = { ligne: number; reference: string; motif: string };

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const ctx = await getTenantContext();
  assertCapability(ctx.role, "catalog:import");

  const { batchId } = await params;
  const shopId = await getActiveShopId(ctx.organizationId, ctx.userId);

  try {
    const result = await withTenantContext(
      { organizationId: ctx.organizationId, shopId },
      async (tx) => {
        // RLS filtre déjà par organisation : un batchId d'une autre
        // organisation ne matche simplement aucune ligne.
        const batch = await tx.importBatch.findUniqueOrThrow({ where: { id: batchId } });
        if (batch.statut !== "EN_ATTENTE") {
          throw new Error("ALREADY_PROCESSED");
        }

        const rows = batch.payload as unknown as ImportRow[];

        // Ne jamais committer sur la base d'une validation devenue obsolète
        // depuis la prévisualisation — on rejoue tout contre l'état courant.
        const [existingProducts, existingVariants] = await Promise.all([
          tx.product.findMany({ select: { reference: true } }),
          tx.productVariant.findMany({
            where: { codeBarres: { not: null } },
            select: { codeBarres: true },
          }),
        ]);
        const existingReferences = new Set(
          existingProducts.map((p) => p.reference.toLowerCase()),
        );
        const existingBarcodes = new Set(
          existingVariants.map((v) => v.codeBarres!.toLowerCase()),
        );
        revalidateRows(rows, existingReferences, existingBarcodes);

        const organization = await tx.organization.findUniqueOrThrow({
          where: { id: ctx.organizationId },
        });

        const categoryIdByName = new Map<string, string>();
        for (const category of await tx.category.findMany()) {
          categoryIdByName.set(category.nom.toLowerCase(), category.id);
        }

        const skipped: SkippedRow[] = [];
        let createdCount = 0;

        for (const row of rows) {
          if (row.errors.length > 0) {
            skipped.push({
              ligne: row.ligne,
              reference: row.reference,
              motif: row.errors.join(" "),
            });
            continue;
          }

          try {
            await assertWithinQuota(tx, ctx.organizationId, organization.plan, "products");
          } catch (error) {
            if (error instanceof QuotaExceededError) {
              skipped.push({ ligne: row.ligne, reference: row.reference, motif: error.message });
              continue;
            }
            throw error;
          }

          let categoryId: string | null = null;
          if (row.categorie) {
            const key = row.categorie.toLowerCase();
            categoryId = categoryIdByName.get(key) ?? null;
            if (!categoryId) {
              const category = await tx.category.create({
                data: { organizationId: ctx.organizationId, nom: row.categorie },
              });
              categoryId = category.id;
              categoryIdByName.set(key, category.id);
            }
          }

          const product = await tx.product.create({
            data: {
              organizationId: ctx.organizationId,
              reference: row.reference,
              designation: row.designation,
              categoryId,
              unite: row.unite,
              tauxTaxe: row.tauxTaxe,
              suiviStock: row.suiviStock,
            },
          });

          const variant = await tx.productVariant.create({
            data: {
              organizationId: ctx.organizationId,
              productId: product.id,
              codeBarres: row.codeBarres,
              prixAchatRef: row.prixAchat,
            },
          });

          await tx.shopPrice.create({
            data: {
              organizationId: ctx.organizationId,
              variantId: variant.id,
              shopId,
              prixVente: row.prixVente,
            },
          });

          if (row.quantiteInitiale > 0) {
            await creditStock(tx, {
              organizationId: ctx.organizationId,
              shopId,
              variantId: variant.id,
              quantite: row.quantiteInitiale,
              coutUnitaire: row.prixAchat,
              documentType: "import_catalogue",
              documentId: batch.id,
              userId: ctx.userId,
              motif: "Stock initial import catalogue",
            });
          }

          createdCount += 1;
        }

        const resultat = { created: createdCount, skipped };

        await tx.importBatch.update({
          where: { id: batch.id },
          data: {
            statut: "COMMITE",
            committedAt: new Date(),
            resultat: resultat as unknown as Prisma.InputJsonValue,
          },
        });

        await recordAuditLog(tx, {
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          action: "CATALOG_IMPORT_COMMITTED",
          entite: "import_batch",
          entiteId: batch.id,
          apres: resultat,
        });

        return resultat;
      },
    );

    revalidatePath("/catalog/products");
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "ALREADY_PROCESSED") {
      return NextResponse.json({ error: "Ce lot a déjà été traité." }, { status: 409 });
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2025"
    ) {
      return NextResponse.json({ error: "Lot d'import introuvable." }, { status: 404 });
    }
    throw error;
  }
}
