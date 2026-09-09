import { cookies } from "next/headers";

import { withTenantContext } from "@/lib/db/tenant-context";

export const ACTIVE_SHOP_COOKIE_NAME = "ts_active_shop_id";

// Multi-boutiques (Phase 3, M18) : le cookie sélectionne la boutique active
// parmi celles auxquelles l'utilisateur est affecté — jamais fait confiance
// tel quel, revalidé contre user_shops à chaque lecture. Retombe sur la
// première boutique affectée si le cookie est absent, invalide, ou pointe
// vers une boutique dont l'utilisateur a depuis été retiré.
export async function getActiveShopId(organizationId: string, userId: string): Promise<string> {
  return withTenantContext({ organizationId }, async (tx) => {
    const userShops = await tx.userShop.findMany({
      where: { userId },
      orderBy: { shopId: "asc" },
    });

    if (userShops.length === 0) {
      throw new Error("Aucune boutique associée à cet utilisateur.");
    }

    const cookieStore = await cookies();
    const requested = cookieStore.get(ACTIVE_SHOP_COOKIE_NAME)?.value;
    if (requested && userShops.some((us) => us.shopId === requested)) {
      return requested;
    }

    return userShops[0].shopId;
  });
}
