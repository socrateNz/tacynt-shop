import { NextResponse } from "next/server";
import type { OnlineOrderFulfillmentMode, OnlineOrderPaymentMode, Organization } from "@prisma/client";

import { recordAuditLog } from "@/lib/audit";
import { withTenantContext } from "@/lib/db/tenant-context";
import { newOnlineOrderEmail } from "@/lib/email/templates";
import { sendMail } from "@/lib/email/send";
import { formatMoney } from "@/lib/money";
import { paymentOptions } from "@/lib/payments/methods";
import { notifyNewOnlineOrder } from "@/lib/push/notify-new-order";
import { computeLineAmounts } from "@/lib/sales/tax";
import { resolveStorefrontShopId } from "@/lib/storefront/context";
import { parseOrgSettings } from "@/lib/tenant/settings";

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

// Public (aucune session) : commande à distance. Paiement à la réception
// par défaut (décision verrouillée Phase 4) ; si la boutique a activé le
// module Codees (Shop.paiementEnLigneActif), un email client est requis ici
// et le paiement est démarré séparément par
// app/api/storefront/payments/initiate. Ne décrémente JAMAIS le stock ici
// (décision #15). Le prix n'est jamais celui envoyé par le client (décision
// #19) : toujours relu depuis ShopPrice au moment de la commande.
//
// Partagé entre la vitrine web (organisation résolue par host,
// app/api/storefront/orders) et l'app mobile Sodu (organisation résolue par
// id, app/api/marketplace/organizations/[organizationId]/orders) — l'appelant
// a déjà résolu ET vérifié l'organisation (modules actifs).
// options.marketplaceCustomerId : compte client Sodu à rattacher (route
// marketplace authentifiée uniquement — la vitrine web n'en passe jamais).
export async function createStorefrontOrder(
  request: Request,
  organization: Organization,
  options: { marketplaceCustomerId?: string } = {},
) {
  const body = (await request.json().catch(() => null)) as {
    shopId?: string;
    nomClient?: string;
    telephoneClient?: string;
    emailClient?: string;
    modeRetrait?: string;
    adresseLivraison?: string;
    notes?: string;
    lines?: OrderLineInput[];
    emballageQuantite?: number;
    modePaiement?: string;
    deliveryZoneId?: string;
    lieuDit?: string;
  } | null;

  if (!body) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const shopId = await resolveStorefrontShopId(organization.id, body.shopId ?? null);
  const nomClient = String(body.nomClient ?? "").trim();
  const telephoneClient = String(body.telephoneClient ?? "").trim();
  const emailClient = String(body.emailClient ?? "").trim() || null;
  const modeRetrait = body.modeRetrait as OnlineOrderFulfillmentMode;
  // Peut être recalculée plus bas ("Zone — lieu-dit") quand la boutique a
  // des zones de livraison.
  let adresseLivraison = String(body.adresseLivraison ?? "").trim() || null;
  const notes = String(body.notes ?? "").trim() || null;
  const lines = (body.lines ?? []).filter(
    (l): l is Required<OrderLineInput> =>
      typeof l.variantId === "string" && Number.isFinite(l.quantite) && (l.quantite ?? 0) > 0,
  );
  // Jamais le prix envoyé par le client (même principe que prixUnitaire
  // ci-dessous) — seule la quantité choisie est retenue, le prix unitaire
  // est recalculé plus bas à partir des produits réellement validés.
  const emballageQuantite = Math.max(0, Math.trunc(Number(body.emballageQuantite ?? 0)));

  if (
    !shopId ||
    !nomClient ||
    !telephoneClient ||
    !FULFILLMENT_MODES.includes(modeRetrait) ||
    (modeRetrait === "LIVRAISON" && !adresseLivraison && !body.deliveryZoneId) ||
    lines.length === 0
  ) {
    return NextResponse.json(
      { error: "Boutique, contact, mode de retrait et au moins un article sont requis." },
      { status: 400 },
    );
  }

  try {
    const order = await withTenantContext({ organizationId: organization.id, shopId }, async (tx) => {
      const shop = await tx.shop.findUniqueOrThrow({ where: { id: shopId } });

      // Mode de paiement : choisi par le client (app Sodu) ou, sans choix
      // explicite (vitrine web historique), en ligne dès que la boutique le
      // propose. Toujours revalidé contre les options réelles de la
      // boutique (lib/payments/methods.ts) — jamais accepté tel quel.
      const payOptions = paymentOptions(organization, shop);
      const modePaiement: OnlineOrderPaymentMode =
        body.modePaiement === "EN_LIGNE" || body.modePaiement === "RECEPTION"
          ? body.modePaiement
          : payOptions.online.length > 0
            ? "EN_LIGNE"
            : "RECEPTION";
      if (modePaiement === "EN_LIGNE" && payOptions.online.length === 0) throw new Error("MODE_PAIEMENT_INDISPONIBLE");
      if (modePaiement === "RECEPTION" && !payOptions.reception) throw new Error("MODE_PAIEMENT_INDISPONIBLE");

      // Livraison : si la boutique a défini des zones, le client DOIT en
      // choisir une (jamais une adresse hors zone) et préciser un lieu-dit.
      // Sans zone définie, adresse libre comme avant (vitrine web existante).
      let deliveryZoneId: string | null = null;
      let zoneLivraisonNom: string | null = null;
      let zoneFrais = 0;
      let lieuDit: string | null = null;
      if (modeRetrait === "LIVRAISON") {
        // Interrupteur global de la boutique (Paramètres de livraison).
        if (!shop.livraisonActive) throw new Error("LIVRAISON_DESACTIVEE");
        const zones = await tx.deliveryZone.findMany({ where: { shopId, actif: true } });
        if (zones.length > 0) {
          const zone = zones.find((z) => z.id === body.deliveryZoneId);
          if (!zone) throw new Error("ZONE_INVALIDE");
          lieuDit = String(body.lieuDit ?? "").trim().slice(0, 300) || null;
          if (!lieuDit) throw new Error("LIEU_DIT_REQUIS");
          deliveryZoneId = zone.id;
          zoneLivraisonNom = zone.nom;
          zoneFrais = Number(zone.frais);
          adresseLivraison = `${zone.nom} — ${lieuDit}`;
        } else if (!adresseLivraison) {
          throw new Error("ADRESSE_REQUISE");
        }
      }

      // Codees exige un email ; inutile si la carte (Stripe) est proposée
      // (désactivée pour l'instant, voir CARTE_ACTIVE).
      if (modePaiement === "EN_LIGNE" && !emailClient && !payOptions.online.includes("STRIPE")) {
        throw new Error("EMAIL_REQUIS");
      }

      let totalHt = 0;
      let totalTaxe = 0;
      // Le plus élevé parmi les prixEmballage des produits réellement
      // commandés — jamais une correspondance 1-pour-1 article/emballage,
      // voir Product.prixEmballage et Cart.emballageQuantite.
      let emballagePrixUnitaire = 0;
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
        // ligne à stock nul OU à quantité supérieure au stock réel ici est
        // équivalent à ce que ferait un vendeur au comptoir avant d'ajouter
        // l'article au panier.
        const stock = variant.stockLevels[0];
        const stockDisponible = stock ? Number(stock.quantite) : 0;
        if (variant.product.suiviStock && line.quantite > stockDisponible) {
          throw new Error(
            `STOCK_INSUFFISANT:${line.variantId}:${stockDisponible}:${encodeURIComponent(variant.product.designation)}`,
          );
        }

        if (variant.product.prixEmballage !== null) {
          emballagePrixUnitaire = Math.max(emballagePrixUnitaire, Number(variant.product.prixEmballage));
        }

        const prixUnitaire = Number(price.prixVente);
        const { ligneHt, ligneTaxe } = computeLineAmounts({
          prixUnitaire,
          quantite: line.quantite,
          remise: 0,
          tauxTaxe: Number(variant.product.tauxTaxe),
          taxeRetenueSource: shop.taxeRetenueSource,
        });
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

      // Si le panier demandait un emballage mais qu'aucun produit validé
      // n'en propose un, pas de montant — jamais inventé côté serveur.
      const emballageMontant = emballageQuantite > 0 ? emballageQuantite * emballagePrixUnitaire : 0;

      // Panier minimum de livraison de la boutique : calculé sur les prix
      // RELUS en base (jamais ceux du client), articles TTC hors emballage.
      const minimumLivraison = shop.montantMinimumLivraison === null ? 0 : Number(shop.montantMinimumLivraison);
      if (modeRetrait === "LIVRAISON" && minimumLivraison > 0 && totalHt + totalTaxe < minimumLivraison) {
        throw new Error(`MINIMUM_LIVRAISON:${minimumLivraison}`);
      }

      // Frais de livraison = prix de la zone, offerts au-delà du seuil de
      // gratuité de la boutique (articles TTC hors emballage, prix relus en
      // base). Figés sur la commande et inclus dans totalTtc — donc dans le
      // montant payé en ligne.
      const seuilGratuite =
        shop.livraisonGratuiteActive && shop.montantLivraisonGratuite !== null
          ? Number(shop.montantLivraisonGratuite)
          : null;
      const fraisLivraison =
        modeRetrait === "LIVRAISON" && !(seuilGratuite !== null && totalHt + totalTaxe >= seuilGratuite)
          ? zoneFrais
          : 0;

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
              emailClient,
              modeRetrait,
              modePaiement,
              adresseLivraison,
              deliveryZoneId,
              zoneLivraisonNom,
              fraisLivraison,
              lieuDit,
              notes,
              totalHt,
              totalTaxe,
              totalTtc: totalHt + totalTaxe + emballageMontant + fraisLivraison,
              emballageQuantite,
              emballagePrixUnitaire: emballageMontant > 0 ? emballagePrixUnitaire : null,
              marketplaceCustomerId: options.marketplaceCustomerId ?? null,
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
        apres: {
          numero: created.numero,
          totalTtc: totalHt + totalTaxe + emballageMontant + fraisLivraison,
          emballageQuantite,
          fraisLivraison,
        },
      });

      return { ...created, shopNom: shop.nom };
    });

    // Non attendu : ne doit jamais ralentir la réponse au client final qui
    // vient de passer commande (route publique, non authentifiée) — toute
    // erreur d'envoi est déjà capturée à l'intérieur de notifyNewOnlineOrder
    // / du try/catch ci-dessous.
    void notifyNewOnlineOrder({
      organizationId: organization.id,
      shopId: order.shopId,
      numero: order.numero,
      nomClient: order.nomClient,
      totalTtcLabel: formatMoney(order.totalTtc, organization.devise),
    });

    const emailAlert = parseOrgSettings(organization.settings).onlineOrderEmailAlert;
    if (emailAlert?.enabled && emailAlert.email) {
      const { subject, html, text } = newOnlineOrderEmail({
        numero: order.numero,
        nomClient: order.nomClient,
        totalTtcLabel: formatMoney(order.totalTtc, organization.devise),
        shopNom: order.shopNom,
      });
      sendMail({ to: emailAlert.email, subject, html, text }).catch((error) => {
        console.error("Échec de l'envoi de l'alerte email nouvelle commande :", error);
      });
    }

    return NextResponse.json({ id: order.id, numero: order.numero, statut: order.statut });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("ARTICLE_INVALIDE:")) {
      return NextResponse.json({ error: "Un article de la commande n'est plus disponible." }, { status: 400 });
    }
    if (error instanceof Error && error.message.startsWith("STOCK_INSUFFISANT:")) {
      const [, , stockDisponible, designationEncoded] = error.message.split(":");
      const designation = designationEncoded ? decodeURIComponent(designationEncoded) : null;
      const message =
        designation && stockDisponible
          ? `Il ne reste que ${stockDisponible} ${designation} en stock.`
          : "Un article de la commande est en rupture de stock.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    if (error instanceof Error && error.message.startsWith("MINIMUM_LIVRAISON:")) {
      const minimum = Number(error.message.split(":")[1]);
      return NextResponse.json(
        {
          error: `La livraison est possible à partir de ${formatMoney(minimum, organization.devise)} d'achats. Ajoutez des articles ou choisissez le retrait en boutique.`,
        },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message === "LIVRAISON_DESACTIVEE") {
      return NextResponse.json(
        { error: "Cette boutique ne propose pas la livraison pour le moment. Choisissez le retrait en boutique." },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message === "ZONE_INVALIDE") {
      return NextResponse.json(
        { error: "Choisissez une zone de livraison proposée par la boutique." },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message === "LIEU_DIT_REQUIS") {
      return NextResponse.json(
        { error: "Précisez le lieu-dit (repère, rue, immeuble…) pour la livraison." },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message === "ADRESSE_REQUISE") {
      return NextResponse.json({ error: "L'adresse de livraison est requise." }, { status: 400 });
    }
    if (error instanceof Error && error.message === "MODE_PAIEMENT_INDISPONIBLE") {
      return NextResponse.json(
        { error: "Ce mode de paiement n'est pas proposé par cette boutique." },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message === "EMAIL_REQUIS") {
      return NextResponse.json(
        { error: "Une adresse email est requise pour le paiement en ligne." },
        { status: 400 },
      );
    }
    throw error;
  }
}
