import { NextResponse } from "next/server";

import { withTenantContext } from "@/lib/db/tenant-context";
import { getTenantContext } from "@/lib/tenant/context";

// Abonnement push (M37) : un enregistrement par navigateur/appareil, jamais
// supprimé physiquement (règle du projet — voir prisma/rls-manifest.sql),
// seulement désactivé. L'endpoint est la clé naturelle : upsert dessus pour
// réactiver proprement un abonnement déjà connu (ex. après un refus de
// permission suivi d'une nouvelle autorisation sur le même navigateur).
export async function POST(request: Request) {
  const ctx = await getTenantContext();

  const body = (await request.json().catch(() => null)) as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  } | null;

  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Abonnement push invalide." }, { status: 400 });
  }

  await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
    await tx.pushSubscription.upsert({
      where: { endpoint },
      create: {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        endpoint,
        p256dh,
        auth,
      },
      update: { userId: ctx.userId, p256dh, auth, actif: true },
    });
  });

  return NextResponse.json({ ok: true });
}

// Désabonnement explicite — marque l'abonnement inactif, ne le supprime
// jamais (même règle que partout ailleurs dans ce projet).
export async function DELETE(request: Request) {
  const ctx = await getTenantContext();

  const body = (await request.json().catch(() => null)) as { endpoint?: string } | null;
  const endpoint = body?.endpoint;
  if (!endpoint) {
    return NextResponse.json({ error: "Endpoint requis." }, { status: 400 });
  }

  await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
    await tx.pushSubscription.updateMany({
      where: { endpoint, userId: ctx.userId },
      data: { actif: false },
    });
  });

  return NextResponse.json({ ok: true });
}
