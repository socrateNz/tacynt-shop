import { NextResponse } from "next/server";

import { revokeMarketplaceSession } from "@/lib/marketplace/auth";

// Révoque le jeton de l'appareil (revokedAt), jamais de suppression.
export async function POST(request: Request) {
  await revokeMarketplaceSession(request);
  return NextResponse.json({ ok: true });
}
