import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { parseWorkbook, revalidateRows } from "@/lib/catalog/import";
import { withTenantContext } from "@/lib/db/tenant-context";
import { assertCapability } from "@/lib/permissions-server";
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";

// Route Handler plutôt que Server Action : un fichier catalogue peut
// dépasser le plafond de 1 Mo des Server Actions.
export async function POST(request: Request) {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "catalog:import");

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Fichier manquant." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let rows;
  try {
    rows = parseWorkbook(buffer);
  } catch {
    return NextResponse.json(
      { error: "Fichier illisible. Formats acceptés : .csv, .xlsx." },
      { status: 400 },
    );
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "Le fichier ne contient aucune ligne." }, { status: 400 });
  }

  const shopId = await getActiveShopId(ctx.organizationId, ctx.userId);

  // Le batch ne stocke que les lignes validées (JSON) — jamais le fichier
  // brut (voir plan M12 : contrat requête en deux temps preview -> commit).
  const batch = await withTenantContext(
    { organizationId: ctx.organizationId, shopId },
    async (tx) => {
      const existingVariants = await tx.productVariant.findMany({
        where: { codeBarres: { not: null } },
        select: { codeBarres: true },
      });
      const existingBarcodes = new Set(
        existingVariants.map((v) => v.codeBarres!.toLowerCase()),
      );

      revalidateRows(rows, existingBarcodes);

      return tx.importBatch.create({
        data: {
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          payload: rows as unknown as Prisma.InputJsonValue,
        },
      });
    },
  );

  const errorCount = rows.filter((r) => r.errors.length > 0).length;

  return NextResponse.json({
    batchId: batch.id,
    rows,
    validCount: rows.length - errorCount,
    errorCount,
  });
}
