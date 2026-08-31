import { NextResponse } from "next/server";

import { withTenantContext } from "@/lib/db/tenant-context";
import { assertCapability } from "@/lib/permissions";
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";

// Snapshot complet (pas de delta par version) : à l'échelle Phase 1 (300
// produits max en STARTER), renvoyer tout le catalogue à chaque démarrage de
// caisse est largement assez rapide. Une vraie synchro incrémentale par
// curseur de version deviendra utile à plus grande échelle (Phase 2+).
export async function GET() {
  const ctx = await getTenantContext();
  assertCapability(ctx.role, "pos:sell");
  const shopId = await getActiveShopId(ctx.organizationId, ctx.userId);

  const products = await withTenantContext(
    { organizationId: ctx.organizationId, shopId },
    (tx) =>
      tx.product.findMany({
        where: { actif: true },
        include: {
          variants: {
            include: { shopPrices: { where: { shopId } } },
          },
        },
      }),
  );

  const catalog = products.flatMap((p) =>
    p.variants
      .filter((v) => v.shopPrices.length > 0)
      .map((v) => ({
        variantId: v.id,
        productId: p.id,
        designation: p.designation,
        reference: p.reference,
        codeBarres: v.codeBarres,
        unite: p.unite,
        tauxTaxe: Number(p.tauxTaxe),
        suiviStock: p.suiviStock,
        prixVente: Number(v.shopPrices[0].prixVente),
        prixPlancher: v.shopPrices[0].prixPlancher
          ? Number(v.shopPrices[0].prixPlancher)
          : null,
      })),
  );

  return NextResponse.json({
    shopId,
    generatedAt: new Date().toISOString(),
    products: catalog,
  });
}
