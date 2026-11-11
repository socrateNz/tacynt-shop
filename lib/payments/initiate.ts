import type { Organization, PaymentProvider } from "@prisma/client";

import { recordAuditLog } from "@/lib/audit";
import { withTenantContext } from "@/lib/db/tenant-context";

import {
  CodeesError,
  CodeesRejectedError,
  DIRECT_MAX_XAF,
  DIRECT_MIN_XAF,
  PAIEMENT_EXPIRATION_MS,
  createCheckout,
  processPayment,
  type CodeesNetwork,
} from "./codees";
import { failureMessage } from "./failure";
import { paymentOptions } from "./methods";
import { STRIPE_SESSION_TTL_MS, StripePaymentError, createStripeCheckout } from "./stripe";

export type InitiateOutcome =
  | { ok: true; mode: "CHECKOUT"; url: string; paymentId: string }
  | { ok: true; mode: "DIRECT"; paymentId: string }
  | { ok: false; detail: string };

// Numéro Mobile Money du client pour le paiement direct (normalisé
// 237XXXXXXXXX) et son opérateur.
export type MobileMoneyPayer = { telephone: string; operateur: CodeesNetwork };

// Paiement direct possible : Codees, numéro fourni, montant dans les bornes
// documentées. Sinon, page de paiement hébergée.
export function directPayer(
  provider: PaymentProvider,
  payer: MobileMoneyPayer | undefined,
  amount: number,
): MobileMoneyPayer | null {
  if (provider !== "CODEES" || !payer) return null;
  return amount >= DIRECT_MIN_XAF && amount <= DIRECT_MAX_XAF ? payer : null;
}

// Erreurs métier attendues — l'appelant les traduit en réponse HTTP.
export class PaymentInitError extends Error {
  constructor(
    readonly code: "COMMANDE_INTROUVABLE" | "STATUT_INVALIDE" | "MOYEN_INDISPONIBLE" | "EMAIL_REQUIS" | "DEJA_PAYEE",
  ) {
    super(code);
  }
}

// Démarre une tentative de paiement en ligne pour une commande existante,
// partagé par la vitrine web et l'app mobile Sodu. Toujours une NOUVELLE
// ligne de paiement et une nouvelle session chez le prestataire (jamais de
// réutilisation d'une URL déjà visitée). Le montant est toujours relu depuis
// la commande en base. La ligne de paiement survit au commit même si le
// prestataire refuse (statut ECHEC + erreur brute), pour la traçabilité.
export async function initiateOrderPayment(params: {
  organization: Organization;
  orderId: string;
  provider: PaymentProvider;
  returnUrl: string;
  // Restreint la commande à un compte client Sodu (route marketplace).
  marketplaceCustomerId?: string;
  // Paiement direct sur le téléphone du client (sans page de paiement).
  mobileMoney?: MobileMoneyPayer;
}): Promise<InitiateOutcome> {
  const { organization, orderId, provider, returnUrl } = params;

  return withTenantContext({ organizationId: organization.id }, async (tx) => {
    const order = await tx.onlineOrder.findUnique({
      where: { id: orderId },
      include: {
        shop: true,
        payments: { where: { statut: "REUSSI" }, take: 1 },
      },
    });
    if (!order || (params.marketplaceCustomerId && order.marketplaceCustomerId !== params.marketplaceCustomerId)) {
      throw new PaymentInitError("COMMANDE_INTROUVABLE");
    }
    if (order.payments.length > 0) throw new PaymentInitError("DEJA_PAYEE");
    if (order.statut !== "EN_ATTENTE") throw new PaymentInitError("STATUT_INVALIDE");
    if (!paymentOptions(organization, order.shop).online.includes(provider)) {
      throw new PaymentInitError("MOYEN_INDISPONIBLE");
    }
    const amount = Math.round(Number(order.totalTtc));
    const direct = directPayer(provider, params.mobileMoney, amount);
    // La page hébergée Codees exige un email client (customer_email) ; le
    // paiement direct et Stripe s'en passent.
    if (provider === "CODEES" && !direct && !order.emailClient) throw new PaymentInitError("EMAIL_REQUIS");

    // Unique même avec un compte marchand partagé entre toutes les
    // organisations — nécessaire à la réconciliation côté prestataire.
    const reference = `${organization.slug}-${order.numero}`;

    const payment = await tx.onlineOrderPayment.create({
      data: {
        organizationId: organization.id,
        referenceMarchand: reference,
        shopId: order.shopId,
        onlineOrderId: order.id,
        fournisseur: provider,
        canal: direct ? "DIRECT" : "CHECKOUT",
        montant: order.totalTtc,
        devise: organization.devise,
        expiresAt: new Date(Date.now() + (provider === "STRIPE" ? STRIPE_SESSION_TTL_MS : PAIEMENT_EXPIRATION_MS)),
      },
    });

    let outcome: InitiateOutcome;
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
        await tx.onlineOrderPayment.update({
          where: { id: payment.id },
          data: {
            statut: "EN_ATTENTE",
            referenceExterne: started.transaction_id,
          },
        });
        await tx.onlineOrderPaymentEvent.create({
          data: {
            organizationId: organization.id,
            shopId: order.shopId,
            onlineOrderPaymentId: payment.id,
            source: "INITIATION",
            statutBrut: "paiement_direct_envoye",
          },
        });
        outcome = { ok: true, mode: "DIRECT", paymentId: payment.id };
      } else {
        const checkout =
          provider === "CODEES"
            ? await createCheckout({
                amount: String(Math.round(Number(order.totalTtc))),
                currency: "XAF",
                reference,
                customer_name: order.nomClient,
                customer_email: order.emailClient!,
                success_url: returnUrl,
                cancel_url: returnUrl,
              }).then((c) => ({ id: c.checkout_id, url: c.checkout_url }))
            : await createStripeCheckout({
                amount: Number(order.totalTtc),
                devise: organization.devise,
                description: `Commande ${order.numero} — ${order.shop.nom}`,
                reference,
                customerEmail: order.emailClient,
                successUrl: returnUrl,
                cancelUrl: returnUrl,
                metadata: {
                  onlineOrderPaymentId: payment.id,
                  organizationId: organization.id,
                },
              });

        await tx.onlineOrderPayment.update({
          where: { id: payment.id },
          data: { statut: "EN_ATTENTE", referenceExterne: checkout.id },
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
        outcome = {
          ok: true,
          mode: "CHECKOUT",
          url: checkout.url,
          paymentId: payment.id,
        };
      }
    } catch (error) {
      const rejected = error instanceof CodeesRejectedError;
      const brut =
        error instanceof CodeesError || error instanceof StripePaymentError ? error.message : "Erreur réseau inconnue.";
      await tx.onlineOrderPayment.update({
        where: { id: payment.id },
        data: {
          statut: "ECHEC",
          erreurBrute: brut,
          codeEchec: rejected ? "PAYMENT_REJECTED" : "PAYMENT_FAILED",
        },
      });
      // Message lisible par le client (le détail brut reste en base).
      const detail = rejected ? failureMessage("PAYMENT_REJECTED") : brut;
      await tx.onlineOrderPaymentEvent.create({
        data: {
          organizationId: organization.id,
          shopId: order.shopId,
          onlineOrderPaymentId: payment.id,
          source: "INITIATION",
          statutBrut: "erreur",
          payloadBrut: { detail: brut },
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
      apres: {
        onlineOrderId: order.id,
        montant: Number(order.totalTtc),
        fournisseur: provider,
        succes: outcome.ok,
      },
    });

    return outcome;
  });
}

export const PAYMENT_INIT_ERRORS: Record<PaymentInitError["code"], { status: number; error: string }> = {
  COMMANDE_INTROUVABLE: { status: 404, error: "Commande introuvable." },
  STATUT_INVALIDE: {
    status: 400,
    error: "Cette commande ne peut plus être payée en ligne.",
  },
  MOYEN_INDISPONIBLE: {
    status: 400,
    error: "Ce moyen de paiement n'est pas disponible pour cette boutique.",
  },
  EMAIL_REQUIS: {
    status: 400,
    error: "Une adresse email est requise pour le paiement Mobile Money.",
  },
  DEJA_PAYEE: { status: 409, error: "Cette commande est déjà payée." },
};
