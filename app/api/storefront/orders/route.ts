import { NextResponse } from "next/server";
import type { OnlineOrderFulfillmentMode } from "@prisma/client";

import { recordAuditLog } from "@/lib/audit";
import { withTenantContext } from "@/lib/db/tenant-context";
import { resolveStorefrontOrganization, resolveStorefrontShopId } from "@/lib/storefront/context";

const FULFILLMENT_MODES: OnlineOrderFulfillmentMode[] = ["RETRAIT_BOUTIQUE", "LIVRAISON"];

type OrderLineInput = { variantId?: string; quantite?: number };

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

// Public (aucune session) : commande à distance, paiement à la réception
// (décision verrouillée Phase 4) — ne décrémente JAMAIS le stock ici
// (décision #15). Le prix n'est jamais celui envoyé par le client (décision
// #19) : toujours relu depuis ShopPrice au moment de la commande.
export async function POST(request: Request) {
  const host = request.headers.get("host") ?? "";
  const organization = await resolveStorefrontOrganization(host);
  if (!organization) {
    return NextResponse.json({ error: "Boutique introuvable." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as {
    shopId?: string;
    nomClient?: string;
    telephoneClient?: string;
    modeRetrait?: string;
    adresseLivraison?: string;
    notes?: string;
    lines?: OrderLineInput[];
  } | null;

  if (!body) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const shopId = await resolveStorefrontShopId(organization.id, body.shopId ?? null);
  const nomClient = String(body.nomClient ?? "").trim();
  const telephoneClient = String(body.telephoneClient ?? "").trim();
  const modeRetrait = body.modeRetrait as OnlineOrderFulfillmentMode;
  const adresseLivraison = String(body.adresseLivraison ?? "").trim() || null;
  const notes = String(body.notes ?? "").trim() || null;
  const lines = (body.lines ?? []).filter(
    (l): l is Required<OrderLineInput> =>
      typeof l.variantId === "string" && Number.isFinite(l.quantite) && (l.quantite ?? 0) > 0,
  );

  if (
    !shopId ||
    !nomClient ||
    !telephoneClient ||
    !FULFILLMENT_MODES.includes(modeRetrait) ||
    (modeRetrait === "LIVRAISON" && !adresseLivraison) ||
    lines.length === 0
  ) {
    return NextResponse.json(
      { error: "Boutique, contact, mode de retrait et au moins un article sont requis." },
      { status: 400 },
    );
  }

  try {
    const order = await withTenantContext({ organizationId: organization.id, shopId }, async (tx) => {
      let totalHt = 0;
      let totalTaxe = 0;
      const preparedLines: {
        variantId: string;
        quantite: number;
        prixUnitaire: number;
        ligneHt: number;
        ligneTaxe: number;
      }[] = [];

      for (const line of lines) {
        const variant = await tx.productVariant.findUnique({
          where: { id: line.variantId },
          include: { product: true, shopPrices: { where: { shopId } }, stockLevels: { where: { shopId } } },
        });

        const price = variant?.shopPrices[0];
        if (!variant || !variant.actif || !variant.product.actif || !price) {
          throw new Error(`ARTICLE_INVALIDE:${line.variantId}`);
        }

        // Garde de saisie en temps réel, pas un rejet rétroactif d'une vente
        // déjà encaissée : rien n'est encore encaissé à ce stade, refuser une
        // ligne à stock nul ici est équivalent à ce que ferait un vendeur au
        // comptoir avant d'ajouter l'article au panier.
        const stock = variant.stockLevels[0];
        if (variant.product.suiviStock && (!stock || Number(stock.quantite) <= 0)) {
          throw new Error(`STOCK_INSUFFISANT:${line.variantId}`);
        }

        const prixUnitaire = Number(price.prixVente);
        const ligneHt = prixUnitaire * line.quantite;
        const ligneTaxe = ligneHt * (Number(variant.product.tauxTaxe) / 100);
        totalHt += ligneHt;
        totalTaxe += ligneTaxe;

        preparedLines.push({
          variantId: line.variantId,
          quantite: line.quantite,
          prixUnitaire,
          ligneHt,
          ligneTaxe,
        });
      }

      // Client léger : recherche souple par téléphone, jamais de contrainte
      // unique nouvelle (décision #14) — ne jamais bloquer une commande
      // légitime pour une correspondance stricte.
      let customer = await tx.customer.findFirst({
        where: { organizationId: organization.id, telephone: telephoneClient },
      });
      if (!customer) {
        customer = await tx.customer.create({
          data: { organizationId: organization.id, nom: nomClient, telephone: telephoneClient },
        });
      }

      // Numéro séquentiel par boutique, retry sur collision rarissime
      // (décision #14/M30) plutôt qu'un compteur dédié comme le ticket-range
      // POS — un volume de commandes en ligne bien plus faible ne justifie
      // pas la même infrastructure de pré-allocation.
      let created = null;
      for (let attempt = 0; attempt < 5 && !created; attempt++) {
        const count = await tx.onlineOrder.count({ where: { shopId } });
        const numero = `WEB-${String(count + 1 + attempt).padStart(5, "0")}`;
        try {
          created = await tx.onlineOrder.create({
            data: {
              organizationId: organization.id,
              shopId,
              numero,
              customerId: customer.id,
              nomClient,
              telephoneClient,
              modeRetrait,
              adresseLivraison,
              notes,
              totalHt,
              totalTaxe,
              totalTtc: totalHt + totalTaxe,
              lines: {
                create: preparedLines.map((l) => ({
                  organizationId: organization.id,
                  shopId,
                  variantId: l.variantId,
                  quantite: l.quantite,
                  prixUnitaire: l.prixUnitaire,
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
        action: "ONLINE_ORDER_CREATED",
        entite: "online_order",
        entiteId: created.id,
        apres: { numero: created.numero, totalTtc: totalHt + totalTaxe },
      });

      return created;
    });

    return NextResponse.json({ id: order.id, numero: order.numero, statut: order.statut });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("ARTICLE_INVALIDE:")) {
      return NextResponse.json({ error: "Un article de la commande n'est plus disponible." }, { status: 400 });
    }
    if (error instanceof Error && error.message.startsWith("STOCK_INSUFFISANT:")) {
      return NextResponse.json({ error: "Un article de la commande est en rupture de stock." }, { status: 400 });
    }
    throw error;
  }
}
