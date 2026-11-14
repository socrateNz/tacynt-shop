import { NextResponse } from "next/server";

import { getMarketplaceCustomer, unauthorized } from "@/lib/marketplace/auth";
import { resolveMarketplaceOrganization } from "@/lib/marketplace/catalog";
import { createStorefrontVehicleBooking } from "@/lib/storefront/create-vehicle-booking";

// Demande de location de véhicule depuis l'app mobile Sodu — compte client
// obligatoire. Même logique que la vitrine web
// (lib/storefront/create-vehicle-booking.ts), avec le compte rattaché pour
// que le client suive le statut dans l'app.
export async function POST(request: Request, { params }: { params: Promise<{ organizationId: string }> }) {
  const customer = await getMarketplaceCustomer(request);
  if (!customer) return unauthorized();

  const { organizationId } = await params;
  const organization = await resolveMarketplaceOrganization(organizationId, "location_vehicules");
  if (!organization) {
    return NextResponse.json({ error: "Boutique introuvable." }, { status: 404 });
  }

  // Coordonnées du compte par défaut ; le client peut en saisir d'autres
  // (réservation pour un proche).
  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const merged = {
    ...body,
    nomClient: String(body.nomClient ?? "").trim() || customer.nom,
    telephoneClient: String(body.telephoneClient ?? "").trim() || customer.telephone,
  };
  const forwarded = new Request(request.url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(merged),
  });

  return createStorefrontVehicleBooking(forwarded, organization, { marketplaceCustomerId: customer.id });
}
