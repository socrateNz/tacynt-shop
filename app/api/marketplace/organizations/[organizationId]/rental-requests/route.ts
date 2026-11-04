import { NextResponse } from "next/server";

import { resolveMarketplaceOrganization } from "@/lib/marketplace/catalog";
import { createStorefrontRentalRequest } from "@/lib/storefront/create-rental-request";

// Demande de réservation depuis l'app mobile Sodu — même logique que la
// vitrine location (lib/storefront/create-rental-request.ts), organisation
// adressée par id.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await params;
  const organization = await resolveMarketplaceOrganization(organizationId, "location");
  if (!organization) {
    return NextResponse.json({ error: "Boutique introuvable." }, { status: 404 });
  }

  return createStorefrontRentalRequest(request, organization);
}
