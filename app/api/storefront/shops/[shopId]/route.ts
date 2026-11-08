import { NextResponse } from "next/server";

import { systemPrisma } from "@/lib/db/system-client";
import { paymentOptions } from "@/lib/payments/methods";
import { resolveStorefrontOrganization } from "@/lib/storefront/context";

// Public (aucune session) : le shopId du panier vit uniquement côté client
// (localStorage, voir app/cart.ts) — commande/page.tsx ne le connaît pas
// côté serveur. Même principe (anonyme, systemPrisma.shop.findFirst) que
// resolveStorefrontShopId() dans lib/storefront/context.ts.
export async function GET(request: Request, { params }: { params: Promise<{ shopId: string }> }) {
  const host = request.headers.get("host") ?? "";
  const organization = await resolveStorefrontOrganization(host);
  if (!organization) {
    return NextResponse.json({ error: "Boutique introuvable." }, { status: 404 });
  }

  const { shopId } = await params;
  const shop = await systemPrisma.shop.findFirst({
    where: { id: shopId, organizationId: organization.id, actif: true },
    select: {
      paiementEnLigneActif: true,
      paiementReceptionActif: true,
      montantMinimumLivraison: true,
      deliveryZones: { where: { actif: true }, select: { id: true, nom: true }, orderBy: { nom: "asc" } },
    },
  });
  if (!shop) {
    return NextResponse.json({ error: "Boutique introuvable." }, { status: 404 });
  }

  // paiementEnLigneActif conservé pour compatibilité ; paymentOptions est
  // la règle complète (pays, prestataires, paiement à la réception).
  return NextResponse.json({
    paiementEnLigneActif: shop.paiementEnLigneActif,
    paymentOptions: paymentOptions(organization, shop),
    // Zones de livraison actives : quand il y en a, la livraison se fait
    // uniquement dans l'une d'elles (+ lieu-dit).
    deliveryZones: shop.deliveryZones,
    montantMinimumLivraison: shop.montantMinimumLivraison === null ? null : Number(shop.montantMinimumLivraison),
  });
}
