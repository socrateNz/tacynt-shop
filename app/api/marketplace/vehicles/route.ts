import { NextResponse } from "next/server";

import { getMarketplaceVehicles } from "@/lib/marketplace/catalog";

// Public, sans auth, servie sur le domaine racine — même raisonnement que
// /api/marketplace/rentals.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
  const take = Number(searchParams.get("take") ?? 24) || 24;

  const vehicles = await getMarketplaceVehicles({
    skip: (page - 1) * take,
    take,
    organizationId: searchParams.get("organizationId") ?? undefined,
    q: searchParams.get("q")?.trim().slice(0, 100) || undefined,
    vehicleId: searchParams.get("vehicleId") ?? undefined,
  });
  return NextResponse.json({ page, vehicles });
}
