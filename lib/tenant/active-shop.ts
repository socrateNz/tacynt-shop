import { withTenantContext } from "@/lib/db/tenant-context";

// Phase 1 (plan STARTER = 1 boutique) : on prend la première boutique de
// l'utilisateur. Le sélecteur multi-boutiques viendra avec la Phase 3.
export async function getActiveShopId(organizationId: string, userId: string): Promise<string> {
  return withTenantContext({ organizationId }, async (tx) => {
    const userShop = await tx.userShop.findFirst({
      where: { userId },
      orderBy: { shopId: "asc" },
    });

    if (!userShop) {
      throw new Error("Aucune boutique associée à cet utilisateur.");
    }

    return userShop.shopId;
  });
}
