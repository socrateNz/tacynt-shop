import type { Organization, PaymentProvider } from "@prisma/client";

import { recordAuditLog } from "@/lib/audit";
import { withTenantContext } from "@/lib/db/tenant-context";
import { notifyLaundryPaid } from "@/lib/marketplace/notifications";
import {
  CodeesError,
  CodeesRejectedError,
  PAIEMENT_EXPIRATION_MS,
  createCheckout,
  processPayment,
} from "@/lib/payments/codees";
import { failureMessage } from "@/lib/payments/failure";
import { directPayer, type MobileMoneyPayer } from "@/lib/payments/initiate";
import { paymentOptions } from "@/lib/payments/methods";
import { fetchProviderStatus, resolveFailureCode } from "@/lib/payments/service";
import { STRIPE_SESSION_TTL_MS, StripePaymentError, createStripeCheckout } from "@/lib/payments/stripe";

// Paiement en ligne du montant DÉCLARÉ d'une commande de blanchisserie.
// Même discipline que le paiement e-commerce (lib/payments/initiate.ts,
// service.ts) : montant relu en base, nouvelle session à chaque tentative,
// statut toujours relu chez le prestataire, jamais confiance au client ni
// au contenu d'un webhook. La régularisation après recomptage se règle au
// retour, hors ligne.

export class LaundryPaymentError extends Error {
  constructor(
    readonly code: "COMMANDE_INTROUVABLE" | "STATUT_INVALIDE" | "MOYEN_INDISPONIBLE" | "EMAIL_REQUIS" | "DEJA_PAYEE",
  ) {
    super(code);
  }
}

export const LAUNDRY_PAYMENT_ERRORS: Record<LaundryPaymentError["code"], { status: number; error: string }> = {
  COMMANDE_INTROUVABLE: { status: 404, error: "Commande introuvable." },
  STATUT_INVALIDE: { status: 400, error: "Cette commande ne peut plus être payée en ligne." },
  MOYEN_INDISPONIBLE: { status: 400, error: "Ce moyen de paiement n'est pas proposé par cette blanchisserie." },
  EMAIL_REQUIS: { status: 400, error: "Une adresse email est requise pour le paiement Mobile Money." },
  DEJA_PAYEE: { status: 409, error: "Cette commande est déjà payée." },
};

export async function initiateLaundryPayment(params: {
  organization: Organization;
  orderId: string;
  provider: PaymentProvider;
  returnUrl: string;
  marketplaceCustomerId: string;
  mobileMoney?: MobileMoneyPayer;
}): Promise<
  { ok: true; mode: "CHECKOUT"; url: string } | { ok: true; mode: "DIRECT" } | { ok: false; detail: string }
> {
  const { organization, orderId, provider, returnUrl } = params;

  return withTenantContext({ organizationId: organization.id }, async (tx) => {
    const order = await tx.laundryOrder.findUnique({
      where: { id: orderId },
      include: { shop: true, payments: { where: { statut: "REUSSI" }, take: 1 } },
    });
    if (!order || order.marketplaceCustomerId !== params.marketplaceCustomerId) {
      throw new LaundryPaymentError("COMMANDE_INTROUVABLE");
    }
    if (order.payments.length > 0) throw new LaundryPaymentError("DEJA_PAYEE");
    if (order.statut === "ANNULEE" || order.statut === "TERMINEE") throw new LaundryPaymentError("STATUT_INVALIDE");
    if (!paymentOptions(organization, order.shop).online.includes(provider)) {
      throw new LaundryPaymentError("MOYEN_INDISPONIBLE");
    }
    const amount = Math.round(Number(order.totalDeclare));
    const direct = directPayer(provider, params.mobileMoney, amount);
    if (provider === "CODEES" && !direct && !order.emailClient) throw new LaundryPaymentError("EMAIL_REQUIS");

    const reference = `${organization.slug}-${order.numero}`;
    const payment = await tx.laundryPayment.create({
      data: {
        organizationId: organization.id,
        referenceMarchand: reference,
        shopId: order.shopId,
        laundryOrderId: order.id,
        fournisseur: provider,
        canal: direct ? "DIRECT" : "CHECKOUT",
        montant: order.totalDeclare,
        devise: organization.devise,
        expiresAt: new Date(Date.now() + (provider === "STRIPE" ? STRIPE_SESSION_TTL_MS : PAIEMENT_EXPIRATION_MS)),
      },
    });

    let outcome:
      { ok: true; mode: "CHECKOUT"; url: string } | { ok: true; mode: "DIRECT" } | { ok: false; detail: string };
    try {
      if (direct) {
        const started = await processPayment({
          amount,
          customer_phone: direct.telephone,
          network_code: direct.operateur,
          reference,
          customer_name: order.nomClient,
          ...(order.emailClient ? { customer_email: order.emailClient } : {}),
        });
        await tx.laundryPayment.update({
          where: { id: payment.id },
          data: { statut: "EN_ATTENTE", referenceExterne: started.transaction_id },
        });
        outcome = { ok: true, mode: "DIRECT" };
      } else {
        const checkout =
          provider === "CODEES"
            ? await createCheckout({
                amount: String(Math.round(Number(order.totalDeclare))),
                currency: "XAF",
                reference,
                customer_name: order.nomClient,
                customer_email: order.emailClient!,
                success_url: returnUrl,
                cancel_url: returnUrl,
              }).then((c) => ({ id: c.checkout_id, url: c.checkout_url }))
            : await createStripeCheckout({
                amount: Number(order.totalDeclare),
                devise: organization.devise,
                description: `Blanchisserie ${order.numero} — ${order.shop.nom}`,
                reference,
                customerEmail: order.emailClient,
                successUrl: returnUrl,
                cancelUrl: returnUrl,
                metadata: { laundryPaymentId: payment.id, organizationId: organization.id },
              });
        await tx.laundryPayment.update({
          where: { id: payment.id },
          data: { statut: "EN_ATTENTE", referenceExterne: checkout.id },
        });
        outcome = { ok: true, mode: "CHECKOUT", url: checkout.url };
      }
    } catch (error) {
      const rejected = error instanceof CodeesRejectedError;
      const brut =
        error instanceof CodeesError || error instanceof StripePaymentError ? error.message : "Erreur réseau inconnue.";
      await tx.laundryPayment.update({
        where: { id: payment.id },
        data: { statut: "ECHEC", erreurBrute: brut, codeEchec: rejected ? "PAYMENT_REJECTED" : "PAYMENT_FAILED" },
      });
      outcome = { ok: false, detail: rejected ? failureMessage("PAYMENT_REJECTED") : brut };
    }

    await recordAuditLog(tx, {
      organizationId: organization.id,
      userId: null,
      action: "LAUNDRY_PAYMENT_INITIATED",
      entite: "laundry_payment",
      entiteId: payment.id,
      apres: {
        laundryOrderId: order.id,
        montant: Number(order.totalDeclare),
        fournisseur: provider,
        succes: outcome.ok,
      },
    });
    return outcome;
  });
}

// Seule source de vérité pour faire avancer un paiement de blanchisserie —
// idempotente, ne lève jamais sur une panne prestataire. Paiement réussi
// d'une commande en attente = commande confirmée.
export async function verifyLaundryPayment(ctx: { organizationId: string; shopId: string }, paymentId: string) {
  const result = await withTenantContext(ctx, async (tx) => {
    const payment = await tx.laundryPayment.findUniqueOrThrow({
      where: { id: paymentId },
      include: { laundryOrder: true },
    });
    const terminal = payment.statut === "REUSSI" || payment.statut === "ECHEC" || payment.statut === "EXPIRE";
    if (terminal) return { payment, order: payment.laundryOrder, justPaid: false };

    if (payment.expiresAt.getTime() < Date.now() || !payment.referenceExterne) {
      const updated = await tx.laundryPayment.update({
        where: { id: paymentId },
        data: {
          statut: payment.referenceExterne ? "EXPIRE" : "ECHEC",
          codeEchec: payment.codeEchec ?? (payment.referenceExterne ? "EXPIRE" : null),
        },
      });
      return { payment: updated, order: payment.laundryOrder, justPaid: false };
    }

    let status;
    try {
      status = await fetchProviderStatus(payment);
    } catch {
      return { payment, order: payment.laundryOrder, justPaid: false };
    }
    if (!status.next) {
      await tx.laundryPayment.update({ where: { id: paymentId }, data: { dernierStatutBrut: status.brut } });
      return { payment, order: payment.laundryOrder, justPaid: false };
    }

    const codeEchec =
      status.next === "REUSSI"
        ? null
        : (status.failureCode ?? (await resolveFailureCode(payment, status.next, status.brut)));
    const updated = await tx.laundryPayment.update({
      where: { id: paymentId },
      data: { statut: status.next, dernierStatutBrut: status.brut, codeEchec },
    });
    let order = payment.laundryOrder;
    if (status.next === "REUSSI" && order.statut === "EN_ATTENTE") {
      order = await tx.laundryOrder.update({
        where: { id: order.id },
        data: { statut: "CONFIRMEE", confirmedAt: new Date() },
      });
    }
    return { payment: updated, order, justPaid: status.next === "REUSSI" };
  });

  if (result.justPaid) void notifyLaundryPaid(result.order.id);
  return result;
}
