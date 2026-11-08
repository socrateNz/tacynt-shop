import { NextResponse } from "next/server";

import { systemPrisma } from "@/lib/db/system-client";
import { resolveMarketplaceOrganization } from "@/lib/marketplace/catalog";
import { paymentOptions } from "@/lib/payments/methods";

// Catalogue blanchisserie d'une organisation pour l'app Sodu (public) : les
// pièces proposées par sa boutique vitrine (première boutique active, même
// règle que le reste du marketplace), et ce qu'il faut pour commander
// (zones + prix pour la collecte/livraison à domicile).
export async function GET(_request: Request, { params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  const organization = await resolveMarketplaceOrganization(organizationId, "blanchisserie");
  if (!organization) return NextResponse.json({ error: "Blanchisserie introuvable." }, { status: 404 });

  const shop = await systemPrisma.shop.findFirst({
    where: { organizationId: organization.id, actif: true },
    orderBy: { nom: "asc" },
    include: {
      laundryItems: { where: { actif: true }, orderBy: [{ categorie: "asc" }, { nom: "asc" }] },
      deliveryZones: { where: { actif: true }, orderBy: { nom: "asc" } },
    },
  });
  if (!shop) return NextResponse.json({ error: "Blanchisserie introuvable." }, { status: 404 });

  return NextResponse.json({
    shopId: shop.id,
    devise: organization.devise,
    // Paiement du montant déclaré (mêmes règles que la boutique en ligne).
    paymentOptions: paymentOptions(organization, shop),
    items: shop.laundryItems.map((i) => ({
      id: i.id,
      nom: i.nom,
      categorie: i.categorie,
      prixUnitaire: Number(i.prixUnitaire),
    })),
    // Collecte / livraison à domicile possibles seulement si la boutique
    // livre et a des zones ; sinon dépôt et retrait en boutique.
    domicileDisponible: shop.livraisonActive && shop.deliveryZones.length > 0,
    deliveryZones: shop.livraisonActive
      ? shop.deliveryZones.map((z) => ({ id: z.id, nom: z.nom, frais: Number(z.frais) }))
      : [],
  });
}
