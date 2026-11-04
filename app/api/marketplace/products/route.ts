import { NextResponse } from "next/server";

import { getMarketplaceProducts } from "@/lib/marketplace/catalog";

// Public, sans auth, servie sur le domaine racine — même raisonnement que
// /api/marketplace/organizations. Pagination simple : la liste grandit avec
// chaque organisation qui active le module marketplace, jamais un
// findMany() non borné (clampTake dans lib/marketplace/catalog.ts plafonne
// déjà take côté serveur, quoi que le client demande).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
  const take = Number(searchParams.get("take") ?? 24) || 24;

  const products = await getMarketplaceProducts({
    skip: (page - 1) * take,
    take,
    organizationId: searchParams.get("organizationId") ?? undefined,
    q: searchParams.get("q")?.trim().slice(0, 100) || undefined,
    productId: searchParams.get("productId") ?? undefined,
  });
  return NextResponse.json({ page, products });
}
