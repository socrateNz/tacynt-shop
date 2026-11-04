import { NextResponse } from "next/server";

import { createStorefrontRentalRequest } from "@/lib/storefront/create-rental-request";
import { resolveStorefrontOrganization } from "@/lib/storefront/context";

// Public (aucune session) : demande de réservation depuis la vitrine
// location, organisation résolue par host. Logique partagée avec l'app
// mobile Sodu dans lib/storefront/create-rental-request.ts.
export async function POST(request: Request) {
  const host = request.headers.get("host") ?? "";
  const organization = await resolveStorefrontOrganization(host, "location");
  if (!organization) {
    return NextResponse.json({ error: "Boutique introuvable." }, { status: 404 });
  }

  return createStorefrontRentalRequest(request, organization);
}
