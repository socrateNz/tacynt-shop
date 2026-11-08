import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { systemPrisma } from "@/lib/db/system-client";
import { withTenantContext } from "@/lib/db/tenant-context";
import { verifyLaundryPayment } from "@/lib/laundry/payments";
import { verifyAndApplyPayment } from "@/lib/payments/service";
import { constructStripeEvent } from "@/lib/payments/stripe";

// Événements Checkout qui peuvent faire avancer un paiement.
const HANDLED = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
]);

// Webhook Stripe (paiement par carte). Contrairement à Codees, Stripe SIGNE
// ses webhooks : tout appel dont la signature ne se vérifie pas est rejeté
// en 400 (Stripe réessaiera, ce qui est voulu en cas de secret mal
// configuré). Même pour un événement signé, on ne fait jamais confiance à son
// contenu pour le statut : verifyAndApplyPayment relit la session chez
// Stripe, seule source de vérité, de façon idempotente.
export async function POST(request: Request) {
  const rawBody = await request.text();

  let event;
  try {
    event = constructStripeEvent(rawBody, request.headers.get("stripe-signature"));
  } catch (error) {
    console.error("Webhook Stripe rejeté (signature invalide ou configuration manquante) :", error);
    return NextResponse.json({ error: "Signature invalide." }, { status: 400 });
  }

  if (!HANDLED.has(event.type)) return NextResponse.json({ received: true });

  try {
    const session = event.data.object as { id?: string };
    if (!session.id) return NextResponse.json({ received: true });

    // Même exception documentée que le webhook Codees : sans Host fiable,
    // seul un select minimal hors RLS permet de retrouver l'organisation.
    const match = await systemPrisma.onlineOrderPayment.findFirst({
      where: { referenceExterne: session.id, fournisseur: "STRIPE" },
      select: { id: true, organizationId: true, shopId: true },
    });
    if (!match) {
      const laundry = await systemPrisma.laundryPayment.findFirst({
        where: { referenceExterne: session.id, fournisseur: "STRIPE" },
        select: { id: true, organizationId: true, shopId: true },
      });
      if (laundry) {
        await verifyLaundryPayment({ organizationId: laundry.organizationId, shopId: laundry.shopId }, laundry.id);
        return NextResponse.json({ received: true });
      }
      console.error("Webhook Stripe : aucun paiement ne correspond à la session", session.id);
      return NextResponse.json({ received: true });
    }

    const ctx = { organizationId: match.organizationId, shopId: match.shopId };
    await withTenantContext(ctx, (tx) =>
      tx.onlineOrderPaymentEvent.create({
        data: {
          organizationId: match.organizationId,
          shopId: match.shopId,
          onlineOrderPaymentId: match.id,
          source: "WEBHOOK",
          statutBrut: event.type,
          payloadBrut: { eventId: event.id, type: event.type, sessionId: session.id } as Prisma.InputJsonValue,
        },
      }),
    );

    await verifyAndApplyPayment(ctx, match.id);
  } catch (error) {
    // Événement authentique mais traitement en échec : 500 pour que Stripe
    // réessaie (verifyAndApplyPayment est idempotent).
    console.error("Échec du traitement du webhook Stripe :", error);
    return NextResponse.json({ error: "Traitement impossible." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
