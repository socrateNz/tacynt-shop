import { NextResponse } from "next/server";

import { createLaundryOrder } from "@/lib/laundry/create-order";
import { getMarketplaceCustomer, unauthorized } from "@/lib/marketplace/auth";
import { resolveMarketplaceOrganization } from "@/lib/marketplace/catalog";

// Commande de blanchisserie depuis l'app Sodu — compte client obligatoire,
// coordonnées du compte par défaut (même principe que les commandes
// produits). Logique dans lib/laundry/create-order.ts.
export async function POST(request: Request, { params }: { params: Promise<{ organizationId: string }> }) {
  const customer = await getMarketplaceCustomer(request);
  if (!customer) return unauthorized();

  const { organizationId } = await params;
  const organization = await resolveMarketplaceOrganization(organizationId, "blanchisserie");
  if (!organization) return NextResponse.json({ error: "Blanchisserie introuvable." }, { status: 404 });

  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const merged = {
    ...body,
    nomClient: String(body.nomClient ?? "").trim() || customer.nom,
    telephoneClient: String(body.telephoneClient ?? "").trim() || customer.telephone,
    emailClient: String(body.emailClient ?? "").trim() || customer.email,
  };
  const forwarded = new Request(request.url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(merged),
  });

  return createLaundryOrder(forwarded, organization, { marketplaceCustomerId: customer.id });
}
