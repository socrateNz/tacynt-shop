import { NextResponse } from "next/server";

import { resolveMarketplaceOrganization } from "@/lib/marketplace/catalog";
import { createStorefrontOrder } from "@/lib/storefront/create-order";

// Commande depuis l'app mobile Sodu : une commande = une seule organisation
// (panier mono-boutique). Organisation adressée par id puisque l'app n'est
// jamais sur le sous-domaine d'une organisation — exactement la même logique
// que la vitrine web ensuite (lib/storefront/create-order.ts).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await params;
  const organization = await resolveMarketplaceOrganization(organizationId, "ecommerce");
  if (!organization) {
    return NextResponse.json({ error: "Boutique introuvable." }, { status: 404 });
  }

  return createStorefrontOrder(request, organization);
}
