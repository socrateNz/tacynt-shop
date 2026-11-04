import { NextResponse } from "next/server";

import { isAllowedAppReturn } from "@/lib/marketplace/payment-return";

// Page de retour des prestataires de paiement pour l'app Sodu : redirige
// vers le lien profond de l'app (fermeture du navigateur intégré). Aucune
// décision de paiement ici — l'app relit le statut réel ensuite
// (/api/marketplace/orders/[orderId]/payment).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const to = searchParams.get("to") ?? "";
  const orderId = searchParams.get("orderId") ?? "";

  if (isAllowedAppReturn(to)) {
    const target = new URL(to);
    if (orderId) target.searchParams.set("orderId", orderId);
    return NextResponse.redirect(target.toString(), 302);
  }

  return new NextResponse(
    `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sodu</title></head><body style="font-family:system-ui;padding:32px;text-align:center"><p>Paiement terminé. Vous pouvez revenir dans l'application Sodu.</p></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
