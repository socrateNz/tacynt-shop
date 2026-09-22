import { cookies } from "next/headers";

import { withTenantContext } from "@/lib/db/tenant-context";

export const ACTIVE_SHOP_COOKIE_NAME = "ts_active_shop_id";

async function fetchUserShopIds(organizationId: string, userId: string): Promise<string[]> {
  return withTenantContext({ organizationId }, async (tx) => {
    const userShops = await tx.userShop.findMany({
      where: { userId },
      orderBy: { shopId: "asc" },
    });
    return userShops.map((us) => us.shopId);
  });
}

// Multi-boutiques (Phase 3, M18) : le cookie sélectionne la boutique active
// parmi celles auxquelles l'utilisateur est affecté — jamais fait confiance
// tel quel, revalidé contre user_shops à chaque lecture. Retombe sur la
// première boutique affectée si le cookie est absent, invalide, ou pointe
// vers une boutique dont l'utilisateur a depuis été retiré.
export async function getActiveShopId(organizationId: string, userId: string): Promise<string> {
  const shopIds = await fetchUserShopIds(organizationId, userId);

  if (shopIds.length === 0) {
    throw new Error("Aucune boutique associée à cet utilisateur.");
  }

  const cookieStore = await cookies();
  const requested = cookieStore.get(ACTIVE_SHOP_COOKIE_NAME)?.value;
  if (requested && shopIds.includes(requested)) {
    return requested;
  }

  return shopIds[0];
}

// Liste complète des boutiques affectées (pas seulement l'active) — c'est la
// vraie frontière de sécurité : un employé affecté à UNE boutique ne doit
// jamais voir ni agir sur les données d'une autre, quel que soit le rôle
// (Gérant compris — "ses boutiques affectées", jamais "toutes les
// boutiques de l'organisation" par défaut). Utilisé partout où une action ou
// une vue doit être validée/filtrée contre l'ensemble des boutiques d'un
// utilisateur plutôt que la seule boutique active du sélecteur d'en-tête :
// rapports consolidés, dépenses, transferts, commandes en ligne, synchro
// caisse. Jamais mis en cache entre requêtes : une désaffectation doit
// prendre effet immédiatement.
export async function getAssignedShopIds(organizationId: string, userId: string): Promise<string[]> {
  return fetchUserShopIds(organizationId, userId);
}
