import { NextResponse } from "next/server";

import { createStorefrontOrder } from "@/lib/storefront/create-order";
import { resolveStorefrontOrganization } from "@/lib/storefront/context";

// Public (aucune session) : commande à distance depuis la vitrine web,
// organisation résolue par host. Toute la logique (prix relus serveur,
// stock, numérotation, notifications) vit dans lib/storefront/create-order.ts,
// partagée avec l'app mobile Sodu.
export async function POST(request: Request) {
  const host = request.headers.get("host") ?? "";
  const organization = await resolveStorefrontOrganization(host);
  if (!organization) {
    return NextResponse.json({ error: "Boutique introuvable." }, { status: 404 });
  }

  return createStorefrontOrder(request, organization);
}
