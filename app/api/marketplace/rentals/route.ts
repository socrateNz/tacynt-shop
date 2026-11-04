import { NextResponse } from "next/server";

import { getMarketplaceRentalUnits } from "@/lib/marketplace/catalog";

// Public, sans auth, servie sur le domaine racine — même raisonnement que
// /api/marketplace/organizations.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
  const take = Number(searchParams.get("take") ?? 24) || 24;

  const units = await getMarketplaceRentalUnits({
    skip: (page - 1) * take,
    take,
    organizationId: searchParams.get("organizationId") ?? undefined,
    q: searchParams.get("q")?.trim().slice(0, 100) || undefined,
    unitId: searchParams.get("unitId") ?? undefined,
  });
  return NextResponse.json({ page, units });
}
