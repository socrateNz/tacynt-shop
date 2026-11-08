import type { LaundryPickupMode, LaundryReturnMode, Organization } from "@prisma/client";
import { NextResponse } from "next/server";

import { recordAuditLog } from "@/lib/audit";
import { paymentOptions } from "@/lib/payments/methods";
import { withTenantContext } from "@/lib/db/tenant-context";
import { resolveStorefrontShopId } from "@/lib/storefront/context";

const PICKUP_MODES: LaundryPickupMode[] = ["COLLECTE_DOMICILE", "DEPOT_BOUTIQUE"];
const RETURN_MODES: LaundryReturnMode[] = ["LIVRAISON", "RETRAIT_BOUTIQUE"];
const MAX_PIECES_PAR_ARTICLE = 500;

type LineInput = { itemId?: string; quantite?: number };

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

// Commande de blanchisserie (app Sodu, puis plus tard d'autres canaux) :
// le client déclare ses pièces. Prix TOUJOURS relus au catalogue de la
// boutique (jamais ceux du client) et figés sur les lignes. Les frais de
// trajet à domicile sont le prix de la zone choisie, une fois par trajet.
// La collecte et le retour s'organisent ensuite hors ligne (pas de
// créneaux) ; le recomptage se fait dans le tableau de bord.
export async function createLaundryOrder(
  request: Request,
  organization: Organization,
  options: { marketplaceCustomerId?: string } = {},
) {
  const body = (await request.json().catch(() => null)) as {
    shopId?: string;
    nomClient?: string;
    telephoneClient?: string;
    emailClient?: string;
    modeAller?: string;
    modeRetour?: string;
    deliveryZoneId?: string;
    lieuDit?: string;
    notes?: string;
    modePaiement?: string;
    lines?: LineInput[];
  } | null;
  if (!body) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });

  const shopId = await resolveStorefrontShopId(organization.id, body.shopId ?? null);
  const nomClient = String(body.nomClient ?? "").trim();
  const telephoneClient = String(body.telephoneClient ?? "").trim();
  const emailClient = String(body.emailClient ?? "").trim() || null;
  const modeAller = body.modeAller as LaundryPickupMode;
  const modeRetour = body.modeRetour as LaundryReturnMode;
  const notes = String(body.notes ?? "").trim().slice(0, 1000) || null;
  const lines = (body.lines ?? []).filter(
    (l): l is Required<LineInput> =>
      typeof l.itemId === "string" &&
      Number.isInteger(l.quantite) &&
      (l.quantite ?? 0) > 0 &&
      (l.quantite ?? 0) <= MAX_PIECES_PAR_ARTICLE,
  );

  if (
    !shopId ||
    !nomClient ||
    !telephoneClient ||
    !PICKUP_MODES.includes(modeAller) ||
    !RETURN_MODES.includes(modeRetour) ||
    lines.length === 0
  ) {
    return NextResponse.json(
      { error: "Boutique, contact, mode de collecte et de retour, et au moins une pièce sont requis." },
      { status: 400 },
    );
  }

  const domicile = modeAller === "COLLECTE_DOMICILE" || modeRetour === "LIVRAISON";

  try {
    const order = await withTenantContext({ organizationId: organization.id, shopId }, async (tx) => {
      // Zone + lieu-dit dès qu'un trajet se fait à domicile, parmi les zones
      // de livraison de la boutique (partagées avec l'e-commerce).
      let deliveryZoneId: string | null = null;
      let zoneLivraisonNom: string | null = null;
      let lieuDit: string | null = null;
      let fraisParTrajet = 0;
      const shop = await tx.shop.findUniqueOrThrow({ where: { id: shopId } });

      // Paiement du montant déclaré : mêmes options que la boutique en ligne
      // (Mobile Money au Cameroun si activé, réception selon la boutique).
      const payOptions = paymentOptions(organization, shop);
      const modePaiement =
        body.modePaiement === "EN_LIGNE" || body.modePaiement === "RECEPTION"
          ? body.modePaiement
          : payOptions.reception
            ? "RECEPTION"
            : "EN_LIGNE";
      if (modePaiement === "EN_LIGNE" && payOptions.online.length === 0) throw new Error("MODE_PAIEMENT_INDISPONIBLE");
      if (modePaiement === "RECEPTION" && !payOptions.reception) throw new Error("MODE_PAIEMENT_INDISPONIBLE");

      if (domicile) {
        if (!shop.livraisonActive) throw new Error("DOMICILE_INDISPONIBLE");
        const zone = await tx.deliveryZone.findFirst({ where: { id: body.deliveryZoneId ?? "", shopId, actif: true } });
        if (!zone) throw new Error("ZONE_INVALIDE");
        lieuDit = String(body.lieuDit ?? "").trim().slice(0, 300) || null;
        if (!lieuDit) throw new Error("LIEU_DIT_REQUIS");
        deliveryZoneId = zone.id;
        zoneLivraisonNom = zone.nom;
        fraisParTrajet = Number(zone.frais);
      }

      const items = await tx.laundryItem.findMany({
        where: { id: { in: lines.map((l) => l.itemId) }, shopId, actif: true },
      });
      const itemById = new Map(items.map((i) => [i.id, i]));
      let montantDeclare = 0;
      const prepared = lines.map((l) => {
        const item = itemById.get(l.itemId);
        if (!item) throw new Error("ARTICLE_INVALIDE");
        const prix = Number(item.prixUnitaire);
        montantDeclare += prix * l.quantite;
        return { item, prix, quantite: l.quantite };
      });

      const fraisCollecte = modeAller === "COLLECTE_DOMICILE" ? fraisParTrajet : 0;
      const fraisLivraison = modeRetour === "LIVRAISON" ? fraisParTrajet : 0;
      const totalDeclare = montantDeclare + fraisCollecte + fraisLivraison;

      // Client léger, recherche souple par téléphone (même règle que les
      // commandes e-commerce).
      let customer = await tx.customer.findFirst({
        where: { organizationId: organization.id, telephone: telephoneClient },
      });
      if (!customer) {
        customer = await tx.customer.create({
          data: { organizationId: organization.id, nom: nomClient, telephone: telephoneClient },
        });
      }

      let created = null;
      for (let attempt = 0; attempt < 5 && !created; attempt++) {
        const count = await tx.laundryOrder.count({ where: { shopId } });
        const numero = `BLA-${String(count + 1 + attempt).padStart(5, "0")}`;
        try {
          created = await tx.laundryOrder.create({
            data: {
              organizationId: organization.id,
              shopId,
              numero,
              customerId: customer.id,
              marketplaceCustomerId: options.marketplaceCustomerId ?? null,
              nomClient,
              telephoneClient,
              emailClient,
              modeAller,
              modeRetour,
              deliveryZoneId,
              zoneLivraisonNom,
              lieuDit,
              notes,
              modePaiement,
              montantDeclare,
              fraisCollecte,
              fraisLivraison,
              totalDeclare,
              lines: {
                create: prepared.map((p) => ({
                  organizationId: organization.id,
                  shopId,
                  laundryItemId: p.item.id,
                  designation: p.item.nom,
                  prixUnitaire: p.prix,
                  quantiteDeclaree: p.quantite,
                })),
              },
            },
          });
        } catch (error) {
          if (!isUniqueViolation(error) || attempt === 4) throw error;
        }
      }
      if (!created) throw new Error("NUMERO_INDISPONIBLE");

      await recordAuditLog(tx, {
        organizationId: organization.id,
        userId: null,
        action: "LAUNDRY_ORDER_CREATED",
        entite: "laundry_order",
        entiteId: created.id,
        apres: { numero: created.numero, totalDeclare, pieces: prepared.reduce((n, p) => n + p.quantite, 0) },
      });

      return created;
    });

    return NextResponse.json({ id: order.id, numero: order.numero, totalDeclare: Number(order.totalDeclare) });
  } catch (error) {
    const messages: Record<string, string> = {
      ARTICLE_INVALIDE: "Un article n'est plus proposé par cette blanchisserie.",
      ZONE_INVALIDE: "Choisissez une zone desservie par la blanchisserie.",
      LIEU_DIT_REQUIS: "Précisez le lieu-dit (repère, rue, immeuble…).",
      MODE_PAIEMENT_INDISPONIBLE: "Ce mode de paiement n'est pas proposé par cette blanchisserie.",
      DOMICILE_INDISPONIBLE:
        "Cette blanchisserie ne propose pas la collecte ni la livraison à domicile : choisissez le dépôt et le retrait en boutique.",
    };
    if (error instanceof Error && messages[error.message]) {
      return NextResponse.json({ error: messages[error.message] }, { status: 400 });
    }
    throw error;
  }
}
