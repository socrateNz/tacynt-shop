import { NextResponse } from "next/server";

import { getMarketplaceCustomer, unauthorized } from "@/lib/marketplace/auth";
import { resolveMarketplaceOrganization } from "@/lib/marketplace/catalog";
import { createStorefrontOrder } from "@/lib/storefront/create-order";

// Commande depuis l'app mobile Sodu — compte client obligatoire. Une commande
// = une seule organisation (panier par boutique). Organisation adressée par
// id (l'app n'est jamais sur un sous-domaine), puis exactement la même
// logique que la vitrine web (lib/storefront/create-order.ts), avec le compte
// rattaché pour que le client suive le statut réel dans l'app.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  const customer = await getMarketplaceCustomer(request);
  if (!customer) return unauthorized();

  const { organizationId } = await params;
  const organization = await resolveMarketplaceOrganization(organizationId, "ecommerce");
  if (!organization) {
    return NextResponse.json({ error: "Boutique introuvable." }, { status: 404 });
  }

  // Coordonnées du compte par défaut ; le client peut en saisir d'autres
  // (commande pour un proche), jamais l'inverse.
  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const merged = {
    ...body,
    nomClient: String(body.nomClient ?? "").trim() || customer.nom,
    telephoneClient: String(body.telephoneClient ?? "").trim() || customer.telephone,
    emailClient: String(body.emailClient ?? "").trim() || customer.email || undefined,
  };
  const forwarded = new Request(request.url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(merged),
  });

  return createStorefrontOrder(forwarded, organization, { marketplaceCustomerId: customer.id });
}
