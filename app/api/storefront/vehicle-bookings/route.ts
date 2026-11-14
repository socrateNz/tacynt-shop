import { NextResponse } from "next/server";

import { resolveStorefrontOrganization } from "@/lib/storefront/context";
import { createStorefrontVehicleBooking } from "@/lib/storefront/create-vehicle-booking";

// Public (aucune session) : demande de location d'un véhicule depuis la
// vitrine, organisation résolue par host. Logique partagée avec l'app mobile
// Sodu dans lib/storefront/create-vehicle-booking.ts.
export async function POST(request: Request) {
  const host = request.headers.get("host") ?? "";
  const organization = await resolveStorefrontOrganization(host, "location_vehicules");
  if (!organization) {
    return NextResponse.json({ error: "Boutique introuvable." }, { status: 404 });
  }

  return createStorefrontVehicleBooking(request, organization);
}
