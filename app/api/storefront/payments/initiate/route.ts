import { NextResponse } from "next/server";

import { recordAuditLog } from "@/lib/audit";
import { withTenantContext } from "@/lib/db/tenant-context";
import { requestOrigin } from "@/lib/http/request-origin";
import { CodeesError, PAIEMENT_EXPIRATION_MS, createCheckout } from "@/lib/payments/codees";
import { resolveStorefrontOrganization } from "@/lib/storefront/context";

type InitiateResult =
  | { ok: true; url: string }
  | { ok: false; detail: string };

// Public (aucune session) : démarre une session de paiement Codees pour une
// commande déjà créée. Pas de champ "moyen" — un seul bouton côté UI, le
// client choisit Orange/MTN sur la page Codees elle-même (contrat de
// l'intégration, section 2). Le montant est toujours relu depuis la commande
// en base, jamais envoyé par le client.
export async function POST(request: Request) {
  const host = request.headers.get("host") ?? "";
  const organization = await resolveStorefrontOrganization(host);
  if (!organization) {
    return NextResponse.json({ error: "Boutique introuvable." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as { orderId?: string } | null;
  const orderId = String(body?.orderId ?? "").trim();
  if (!orderId) {
    return NextResponse.json({ error: "Commande requise." }, { status: 400 });
  }

  try {
    const result = await withTenantContext({ organizationId: organization.id }, async (tx) => {
      const order = await tx.onlineOrder.findUnique({
        where: { id: orderId },
        include: { shop: true },
      });
      if (!order) throw new Error("COMMANDE_INTROUVABLE");
      if (!order.shop.paiementEnLigneActif) throw new Error("PAIEMENT_NON_ACTIF");
      if (order.statut !== "EN_ATTENTE") throw new Error("STATUT_INVALIDE");
      if (!order.emailClient) throw new Error("EMAIL_REQUIS");

      // Toujours une nouvelle ligne / une nouvelle session Codees — jamais de
      // réutilisation d'un checkout_url déjà visité (cause connue de "CSRF
      // token missing" chez Codees après un clic retour arrière + reclic).
      const payment = await tx.onlineOrderPayment.create({
        data: {
          organizationId: organization.id,
          shopId: order.shopId,
          onlineOrderId: order.id,
          montant: order.totalTtc,
          expiresAt: new Date(Date.now() + PAIEMENT_EXPIRATION_MS),
        },
      });

      const returnUrl = new URL(`/merci/${order.id}`, requestOrigin(request)).toString();
      // Unique même avec un compte marchand partagé entre toutes les
      // organisations de la plateforme (décision verrouillée : un seul
      // compte Codees) — nécessaire pour la réconciliation manuelle côté
      // tableau de bord Codees.
      const reference = `${organization.slug}-${order.numero}`;

      let outcome: InitiateResult;
      try {
        const checkout = await createCheckout({
          amount: String(Math.round(Number(order.totalTtc))),
          currency: "XAF",
          reference,
          customer_name: order.nomClient,
          customer_email: order.emailClient,
          success_url: returnUrl,
          cancel_url: returnUrl,
        });

        await tx.onlineOrderPayment.update({
          where: { id: payment.id },
          data: { statut: "EN_ATTENTE", referenceExterne: checkout.checkout_id },
        });
        await tx.onlineOrderPaymentEvent.create({
          data: {
            organizationId: organization.id,
            shopId: order.shopId,
            onlineOrderPaymentId: payment.id,
            source: "INITIATION",
            statutBrut: "checkout_cree",
          },
        });
        outcome = { ok: true, url: checkout.checkout_url };
      } catch (error) {
        // Capturé ici, PAS relevé : la ligne de paiement ECHEC doit survivre
        // au commit même si Codees a refusé l'appel — relever ferait annuler
        // toute la transaction et perdre cette trace.
        const detail = error instanceof CodeesError ? error.message : "Erreur réseau inconnue.";
        await tx.onlineOrderPayment.update({
          where: { id: payment.id },
          data: { statut: "ECHEC", erreurBrute: detail },
        });
        await tx.onlineOrderPaymentEvent.create({
          data: {
            organizationId: organization.id,
            shopId: order.shopId,
            onlineOrderPaymentId: payment.id,
            source: "INITIATION",
            statutBrut: "erreur",
            payloadBrut: { detail },
          },
        });
        outcome = { ok: false, detail };
      }

      await recordAuditLog(tx, {
        organizationId: organization.id,
        userId: null,
        action: "ONLINE_ORDER_PAYMENT_INITIATED",
        entite: "online_order_payment",
        entiteId: payment.id,
        apres: { onlineOrderId: order.id, montant: Number(order.totalTtc), succes: outcome.ok },
      });

      return outcome;
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.detail }, { status: 502 });
    }
    return NextResponse.json({ url: result.url });
  } catch (error) {
    if (error instanceof Error && error.message === "COMMANDE_INTROUVABLE") {
      return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "PAIEMENT_NON_ACTIF") {
      return NextResponse.json(
        { error: "Le paiement en ligne n'est pas actif pour cette boutique." },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message === "STATUT_INVALIDE") {
      return NextResponse.json({ error: "Cette commande ne peut plus être payée en ligne." }, { status: 400 });
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
