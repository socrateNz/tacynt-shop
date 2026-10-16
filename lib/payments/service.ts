import type { OnlineOrderPaymentStatus, Prisma } from "@prisma/client";

import { withTenantContext } from "@/lib/db/tenant-context";
import { sendMail } from "@/lib/email/send";
import { orderConfirmationEmail } from "@/lib/email/templates";
import { formatMoney } from "@/lib/money";

import { CodeesError, getCheckoutStatus, type CodeesCheckoutStatus } from "./codees";

function mapCodeesStatus(status: CodeesCheckoutStatus): OnlineOrderPaymentStatus | null {
  switch (status) {
    case "completed":
      return "REUSSI";
    case "failed":
    case "cancelled":
      return "ECHEC";
    case "expired":
      return "EXPIRE";
    case "open":
    case "processing":
    default:
      return null;
  }
}

type TenantRef = { organizationId: string; shopId: string };

// Seule source de vérité pour faire progresser une commande suite à un
// paiement Codees — idempotente (ne fait rien si le paiement est déjà dans
// un état terminal), et jamais levée en erreur sur une panne Codees (une
// panne réseau ne doit jamais faire planter un appelant en 500, exigence de
// l'intégration). Le filet de sécurité d'expiration tourne EN PREMIER,
// avant tout appel Codees, pour une session déjà hors délai.
export async function verifyAndApplyPayment(ctx: TenantRef, paymentId: string) {
  const result = await withTenantContext(ctx, async (tx) => {
    const payment = await tx.onlineOrderPayment.findUniqueOrThrow({
      where: { id: paymentId },
      include: { onlineOrder: { include: { shop: true } } },
    });
    const shopNom = payment.onlineOrder.shop.nom;

    if (payment.statut === "REUSSI" || payment.statut === "ECHEC" || payment.statut === "EXPIRE") {
      return { payment, order: payment.onlineOrder, shopNom, justConfirmed: false };
    }

    if (payment.expiresAt.getTime() < Date.now() || !payment.referenceExterne) {
      const updated = await tx.onlineOrderPayment.update({
        where: { id: paymentId },
        data: { statut: payment.referenceExterne ? "EXPIRE" : "ECHEC" },
      });
      await tx.onlineOrderPaymentEvent.create({
        data: {
          organizationId: ctx.organizationId,
          shopId: ctx.shopId,
          onlineOrderPaymentId: paymentId,
          source: "EXPIRATION_FILET",
          statutBrut: payment.referenceExterne ? "expire_local" : "jamais_initie_chez_codees",
        },
      });
      return { payment: updated, order: payment.onlineOrder, shopNom, justConfirmed: false };
    }

    let statusResult;
    try {
      statusResult = await getCheckoutStatus(payment.referenceExterne);
    } catch (error) {
      const detail = error instanceof CodeesError ? error.message : "Erreur réseau inconnue.";
      await tx.onlineOrderPaymentEvent.create({
        data: {
          organizationId: ctx.organizationId,
          shopId: ctx.shopId,
          onlineOrderPaymentId: paymentId,
          source: "STATUT_POLL",
          statutBrut: "erreur_reseau",
          payloadBrut: { detail },
        },
      });
      return { payment, order: payment.onlineOrder, shopNom, justConfirmed: false };
    }

    await tx.onlineOrderPaymentEvent.create({
      data: {
        organizationId: ctx.organizationId,
        shopId: ctx.shopId,
        onlineOrderPaymentId: paymentId,
        source: "STATUT_POLL",
        statutBrut: statusResult.status,
        payloadBrut: statusResult as unknown as Prisma.InputJsonValue,
      },
    });

    const nextStatut = mapCodeesStatus(statusResult.status);
    if (!nextStatut) {
      // open|processing : on reste en attente, rien à mettre à jour.
      return { payment, order: payment.onlineOrder, shopNom, justConfirmed: false };
    }

    const updatedPayment = await tx.onlineOrderPayment.update({
      where: { id: paymentId },
      data: { statut: nextStatut },
    });

    let order: typeof payment.onlineOrder = payment.onlineOrder;
    let justConfirmed = false;
    if (nextStatut === "REUSSI" && order.statut === "EN_ATTENTE") {
      const confirmed = await tx.onlineOrder.update({
        where: { id: order.id },
        data: { statut: "CONFIRMEE", confirmedAt: new Date() },
      });
      order = { ...order, ...confirmed };
      justConfirmed = true;
    }

    return { payment: updatedPayment, order, shopNom, justConfirmed };
  });

  // Toujours APRÈS le commit, jamais dans la transaction : un échec d'envoi
  // d'email ne doit jamais invalider un paiement déjà réussi.
  if (result.justConfirmed && result.order.emailClient) {
    try {
      const { subject, html, text } = orderConfirmationEmail({
        numero: result.order.numero,
        totalTtcLabel: formatMoney(result.order.totalTtc, result.payment.devise),
        shopNom: result.shopNom,
      });
      await sendMail({ to: result.order.emailClient, subject, html, text });
    } catch (error) {
      console.error("Échec de l'envoi de l'email de confirmation de paiement :", error);
    }
  }

  return result;
}
