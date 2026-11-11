import type { OnlineOrderPaymentStatus, Prisma } from "@prisma/client";

import { withTenantContext } from "@/lib/db/tenant-context";
import { sendMail } from "@/lib/email/send";
import { orderConfirmationEmail } from "@/lib/email/templates";
import { formatMoney } from "@/lib/money";

import type { OnlineOrderPayment } from "@prisma/client";

import { notifyOrderPaid } from "@/lib/marketplace/notifications";

import { CodeesError, getCheckoutStatus, getPaymentStatus, type CodeesCheckoutStatus } from "./codees";
import { fetchCodeesFailure } from "./failure";
import { getStripeCheckoutState, type StripeSessionState } from "./stripe";

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

function mapStripeState(state: StripeSessionState): OnlineOrderPaymentStatus | null {
  switch (state) {
    case "paid":
      return "REUSSI";
    case "expired":
      return "EXPIRE";
    case "unpaid_complete":
      return "ECHEC";
    case "open":
    default:
      return null;
  }
}

// Statut d'une transaction Mobile Money en paiement direct
// (/payment/status/) : pending/processing = en attente.
function mapCodeesTransaction(status: string): OnlineOrderPaymentStatus | null {
  switch (status) {
    case "completed":
      return "REUSSI";
    case "failed":
    case "cancelled":
    case "reversed":
    case "refunded":
      return "ECHEC";
    default:
      return null;
  }
}

export type ProviderState = {
  next: OnlineOrderPaymentStatus | null;
  brut: string;
  raw: unknown;
  // Raison d'échec déjà connue (paiement direct : donnée avec le statut).
  failureCode?: string | null;
};

// Interroge le prestataire de CE paiement (jamais l'autre) et renvoie le
// statut local correspondant (null = toujours en attente) + la réponse brute
// pour le journal. Partagé avec les paiements de blanchisserie.
export async function fetchProviderStatus(payment: {
  fournisseur: OnlineOrderPayment["fournisseur"];
  canal: OnlineOrderPayment["canal"];
  referenceExterne: string | null;
}): Promise<ProviderState> {
  const ref = payment.referenceExterne!;
  if (payment.fournisseur === "STRIPE") {
    const { state, raw } = await getStripeCheckoutState(ref);
    return { next: mapStripeState(state), brut: state, raw };
  }
  if (payment.canal === "DIRECT") {
    const result = await getPaymentStatus({ transactionId: ref });
    const next = mapCodeesTransaction(result.status);
    const failureCode =
      next === "ECHEC"
        ? (result.failure_code ?? (result.status === "reversed" || result.status === "refunded" ? "REVERSED" : null))
        : null;
    return { next, brut: result.status, raw: result, failureCode };
  }
  const result = await getCheckoutStatus(ref);
  return { next: mapCodeesStatus(result.status), brut: result.status, raw: result };
}

type TenantRef = { organizationId: string; shopId: string };

// Raison d'un paiement terminé (null si réussi). Codees ne la donne pas dans
// le statut de session : on la lit sur la transaction (par référence
// marchand), sauf si le webhook l'a déjà enregistrée.
export async function resolveFailureCode(
  payment: { fournisseur: string; codeEchec: string | null; referenceMarchand: string | null },
  next: OnlineOrderPaymentStatus,
  brut: string,
): Promise<string | null> {
  if (next === "REUSSI") return null;
  if (payment.fournisseur !== "CODEES") return payment.codeEchec ?? (next === "EXPIRE" ? "EXPIRE" : null);
  if (next === "EXPIRE") return payment.codeEchec ?? "EXPIRE";
  if (payment.codeEchec) return payment.codeEchec;
  const fetched = payment.referenceMarchand ? await fetchCodeesFailure({ reference: payment.referenceMarchand }) : null;
  return fetched?.code ?? (brut === "cancelled" ? "ANNULE" : "PAYMENT_FAILED");
}

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
        data: {
          statut: payment.referenceExterne ? "EXPIRE" : "ECHEC",
          codeEchec: payment.codeEchec ?? (payment.referenceExterne ? "EXPIRE" : null),
        },
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
      statusResult = await fetchProviderStatus(payment);
    } catch (error) {
      const detail =
        error instanceof CodeesError || error instanceof Error ? error.message : "Erreur réseau inconnue.";
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
        statutBrut: statusResult.brut,
        payloadBrut: statusResult.raw as Prisma.InputJsonValue,
      },
    });

    const nextStatut = statusResult.next;
    if (!nextStatut) {
      // open|processing : on reste en attente, rien à mettre à jour.
      return { payment, order: payment.onlineOrder, shopNom, justConfirmed: false };
    }

    const codeEchec =
      nextStatut === "REUSSI"
        ? null
        : (statusResult.failureCode ?? (await resolveFailureCode(payment, nextStatut, statusResult.brut)));
    const updatedPayment = await tx.onlineOrderPayment.update({
      where: { id: paymentId },
      data: { statut: nextStatut, codeEchec },
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

  // Notification push au client Sodu (si la commande vient de l'app) —
  // après le commit, jamais bloquante.
  if (result.justConfirmed) {
    void notifyOrderPaid(result.order.id);
  }

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
