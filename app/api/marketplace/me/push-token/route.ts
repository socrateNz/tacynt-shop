import { NextResponse } from "next/server";

import { marketplacePrisma } from "@/lib/db/marketplace-client";
import { getMarketplaceCustomer, unauthorized } from "@/lib/marketplace/auth";

// Format des jetons Expo : ExponentPushToken[...] ou ExpoPushToken[...].
const EXPO_TOKEN_RE = /^Expo(nent)?PushToken\[[^\]]{10,200}\]$/;

// Enregistre (ou réactive) l'appareil du client connecté pour les
// notifications push. Un même appareil changeant de compte est rattaché au
// nouveau compte (le jeton est unique).
export async function POST(request: Request) {
  const customer = await getMarketplaceCustomer(request);
  if (!customer) return unauthorized();

  const body = (await request.json().catch(() => null)) as { token?: string; platform?: string } | null;
  const token = String(body?.token ?? "").trim();
  const platform = body?.platform === "ios" || body?.platform === "android" ? body.platform : null;
  if (!EXPO_TOKEN_RE.test(token)) {
    return NextResponse.json({ error: "Jeton de notification invalide." }, { status: 400 });
  }

  await marketplacePrisma.marketplacePushToken.upsert({
    where: { token },
    create: { token, platform, marketplaceCustomerId: customer.id },
    update: { marketplaceCustomerId: customer.id, platform, lastSeenAt: new Date(), disabledAt: null },
  });
  return NextResponse.json({ ok: true });
}

// Désactive l'appareil (déconnexion) — jamais de suppression. Limité aux
// jetons du compte connecté.
export async function DELETE(request: Request) {
  const customer = await getMarketplaceCustomer(request);
  if (!customer) return unauthorized();

  const body = (await request.json().catch(() => null)) as { token?: string } | null;
  const token = String(body?.token ?? "").trim();
  if (token) {
    await marketplacePrisma.marketplacePushToken.updateMany({
      where: { token, marketplaceCustomerId: customer.id, disabledAt: null },
      data: { disabledAt: new Date() },
    });
  }
  return NextResponse.json({ ok: true });
}
