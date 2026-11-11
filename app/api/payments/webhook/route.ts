import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { systemPrisma } from "@/lib/db/system-client";
import { withTenantContext } from "@/lib/db/tenant-context";
import { verifyLaundryPayment } from "@/lib/laundry/payments";
import { verifyCodeesSignature } from "@/lib/payments/codees";
import { fetchCodeesFailure } from "@/lib/payments/failure";
import { verifyAndApplyPayment } from "@/lib/payments/service";

// Hors de app/api/storefront/ : Codees n'a aucune notion des sous-domaines
// par organisation de ce projet (un seul compte marchand global) et
// n'enverra jamais de header Host fiable pour résoudre un tenant.
//
// Format documenté (https://pay.codees-cm.com/docs/) :
//   { "event": "payment.status_updated",
//     "data": { "transaction_id", "external_reference", "status", ... } }
// external_reference = la référence marchand envoyée à la création du
// checkout ("{slug}-{numero}"). Signé par X-Codees-Signature (HMAC-SHA256 du
// corps brut) quand CODEES_WEBHOOK_SECRET est configuré.
//
// On ne fait jamais confiance au statut reçu : il sert seulement à
// retrouver le paiement, dont le statut est ensuite relu chez Codees.
// Réponse 200 dès que la requête est authentique (sinon Codees réessaie).

type Ref = { id: string; organizationId: string; shopId: string };

function str(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    const signature = verifyCodeesSignature(raw, request.headers.get("x-codees-signature"));
    if (signature === "invalide") {
      console.error("Webhook Codees rejeté : signature invalide.");
      return NextResponse.json({ error: "Signature invalide." }, { status: 401 });
    }

    let body: Record<string, unknown> | null = null;
    try {
      body = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      body = null;
    }
    if (str(body?.event) === "test.ping") return NextResponse.json({ received: true });

    const data = (body?.data ?? {}) as Record<string, unknown>;
    const externalReference = str(data.external_reference) ?? str(body?.reference);
    const transactionId = str(data.transaction_id);
    const statutRecu = str(data.status) ?? str(body?.status);
    // Anciens formats / identifiants de session, gardés en secours.
    const sessionId =
      str(body?.checkout_id) ?? str(data.checkout_id) ?? str(body?.id) ?? str(body?.payment_id) ?? transactionId;

    // Seule exception volontaire à "jamais systemPrisma pour des données
    // tenant" : sans Host fiable, c'est le seul moyen de savoir à quelle
    // organisation appartient ce paiement. Portée au strict minimum.
    const select = { id: true, organizationId: true, shopId: true } as const;
    // Plusieurs tentatives partagent une référence marchand : la plus récente.
    const latest = { orderBy: { createdAt: "desc" as const }, select };

    let orderPayment: Ref | null = null;
    let laundryPayment: Ref | null = null;
    if (externalReference) {
      orderPayment = await systemPrisma.onlineOrderPayment.findFirst({
        where: { referenceMarchand: externalReference },
        ...latest,
      });
      if (!orderPayment) {
        laundryPayment = await systemPrisma.laundryPayment.findFirst({
          where: { referenceMarchand: externalReference },
          ...latest,
        });
      }
    }
    if (!orderPayment && !laundryPayment && sessionId) {
      orderPayment = await systemPrisma.onlineOrderPayment.findFirst({ where: { referenceExterne: sessionId }, select });
      if (!orderPayment) {
        laundryPayment = await systemPrisma.laundryPayment.findFirst({ where: { referenceExterne: sessionId }, select });
      }
    }

    if (!orderPayment && !laundryPayment) {
      console.error("Webhook Codees : aucun paiement ne correspond à", { externalReference, sessionId });
      return NextResponse.json({ received: true });
    }

    // Transaction échouée : on garde sa raison (solde insuffisant…) même si
    // la session de paiement reste ouverte pour une nouvelle tentative.
    const failureQuery = transactionId
      ? { transactionId }
      : externalReference
        ? { reference: externalReference }
        : null;
    const failure =
      (statutRecu === "failed" || statutRecu === "cancelled") && failureQuery
        ? await fetchCodeesFailure(failureQuery)
        : null;

    if (laundryPayment) {
      const ctx = { organizationId: laundryPayment.organizationId, shopId: laundryPayment.shopId };
      if (failure) {
        await withTenantContext(ctx, (tx) =>
          tx.laundryPayment.updateMany({
            where: { id: laundryPayment.id, statut: { in: ["INITIE", "EN_ATTENTE"] } },
            data: { codeEchec: failure.code, erreurBrute: failure.message },
          }),
        );
      }
      try {
        await verifyLaundryPayment(ctx, laundryPayment.id);
      } catch (error) {
        console.error("Échec de la vérification d'un paiement blanchisserie (webhook Codees) :", error);
      }
      return NextResponse.json({ received: true });
    }

    const match = orderPayment!;
    const ctx = { organizationId: match.organizationId, shopId: match.shopId };

    // Horodate la réception avant toute vérification, pour ne jamais perdre
    // la trace brute même si verifyAndApplyPayment échoue derrière.
    await withTenantContext(ctx, async (tx) => {
      await tx.onlineOrderPaymentEvent.create({
        data: {
          organizationId: match.organizationId,
          shopId: match.shopId,
          onlineOrderPaymentId: match.id,
          source: "WEBHOOK",
          statutBrut: statutRecu,
          payloadBrut: body ? (body as Prisma.InputJsonValue) : undefined,
        },
      });
      if (failure) {
        await tx.onlineOrderPayment.updateMany({
          where: { id: match.id, statut: { in: ["INITIE", "EN_ATTENTE"] } },
          data: { codeEchec: failure.code, erreurBrute: failure.message },
        });
      }
    });

    try {
      await verifyAndApplyPayment(ctx, match.id);
    } catch (error) {
      console.error("Échec de la vérification du paiement déclenchée par le webhook Codees :", error);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Erreur inattendue dans le webhook Codees :", error);
    return NextResponse.json({ received: true });
  }
}
