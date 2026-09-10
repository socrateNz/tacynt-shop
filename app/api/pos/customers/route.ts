import { NextResponse } from "next/server";

import { withTenantContext } from "@/lib/db/tenant-context";
import { assertCapability } from "@/lib/permissions-server";
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";

// Snapshot complet, même logique que /api/pos/catalog : le solde renvoyé
// reflète l'état au moment de la synchro, pas en temps réel (des ventes à
// crédit non encore synchronisées côté d'autres postes ne sont pas comptées
// — cohérent avec le reste du système hors-ligne-tolérant).
export async function GET() {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "pos:sell");
  const shopId = await getActiveShopId(ctx.organizationId, ctx.userId);

  const [customers, balances, pointsBalances, categoryPrices] = await withTenantContext(
    { organizationId: ctx.organizationId, shopId },
    async (tx) => {
      const customers = await tx.customer.findMany({ where: { actif: true } });
      const balances = await tx.customerLedger.groupBy({
        by: ["customerId"],
        _sum: { montant: true },
      });
      const pointsBalances = await tx.loyaltyLedger.groupBy({
        by: ["customerId"],
        _sum: { points: true },
      });
      const categoryPrices = await tx.customerCategoryPrice.findMany({ where: { shopId } });
      return [customers, balances, pointsBalances, categoryPrices] as const;
    },
  );

  const balanceByCustomer = new Map(
    balances.map((b) => [b.customerId, Number(b._sum.montant ?? 0)]),
  );
  const pointsByCustomer = new Map(
    pointsBalances.map((p) => [p.customerId, p._sum.points ?? 0]),
  );

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    customers: customers.map((c) => ({
      id: c.id,
      nom: c.nom,
      telephone: c.telephone,
      categorieTarif: c.categorieTarif,
      plafondCredit: Number(c.plafondCredit),
      solde: balanceByCustomer.get(c.id) ?? 0,
      pointsFidelite: pointsByCustomer.get(c.id) ?? 0,
    })),
    categoryPrices: categoryPrices.map((p) => ({
      variantId: p.variantId,
      categorieTarif: p.categorieTarif,
      prixVente: Number(p.prixVente),
    })),
  });
}
