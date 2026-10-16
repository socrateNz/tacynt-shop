import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { systemPrisma } from "@/lib/db/system-client";
import { withTenantContext } from "@/lib/db/tenant-context";
import { verifyAndApplyPayment } from "@/lib/payments/service";

// Hors de app/api/storefront/ : Codees n'a aucune notion des sous-domaines
// par organisation de ce projet (un seul compte marchand global) et
// n'enverra jamais de header Host fiable pour résoudre un tenant.
//
// Format du webhook NON documenté, AUCUNE signature : on ne fait jamais
// confiance au contenu reçu — on en extrait seulement un identifiant
// probable, et on retrouve nous-mêmes la ligne de paiement correspondante.
// Réponse TOUJOURS 200 (sinon Codees réessaiera indéfiniment).
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const candidateId =
      (typeof body?.checkout_id === "string" && body.checkout_id) ||
      (typeof body?.id === "string" && body.id) ||
      (typeof (body?.data as { checkout_id?: unknown } | undefined)?.checkout_id === "string" &&
        (body!.data as { checkout_id: string }).checkout_id) ||
      (typeof body?.payment_id === "string" && body.payment_id) ||
      (typeof body?.reference === "string" && body.reference) ||
      null;

    if (!candidateId) {
      console.error("Webhook Codees reçu sans identifiant de checkout reconnaissable :", body);
      return NextResponse.json({ received: true });
    }

    // Seule exception volontaire à "jamais systemPrisma pour des données
    // tenant" : il n'existe aucun autre moyen de savoir à quelle
    // organisation/boutique appartient ce paiement sans Host fiable. Portée
    // au strict minimum (un seul select, aucune donnée métier lue/écrite ici).
    const match = await systemPrisma.onlineOrderPayment.findFirst({
      where: { referenceExterne: candidateId },
      select: { id: true, organizationId: true, shopId: true },
    });

    if (!match) {
      console.error("Webhook Codees : aucun paiement ne correspond à", candidateId);
      return NextResponse.json({ received: true });
    }

    const ctx = { organizationId: match.organizationId, shopId: match.shopId };

    // Horodate la réception avant toute vérification, pour ne jamais perdre
    // la trace brute même si verifyAndApplyPayment échoue derrière.
    await withTenantContext(ctx, (tx) =>
      tx.onlineOrderPaymentEvent.create({
        data: {
          organizationId: match.organizationId,
          shopId: match.shopId,
          onlineOrderPaymentId: match.id,
          source: "WEBHOOK",
          statutBrut: typeof body?.status === "string" ? body.status : null,
          payloadBrut: body ? (body as Prisma.InputJsonValue) : undefined,
        },
      }),
    );

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
