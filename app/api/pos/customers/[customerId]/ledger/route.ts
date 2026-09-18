import { NextResponse } from "next/server";

import { withTenantContext } from "@/lib/db/tenant-context";
import { assertCapability } from "@/lib/permissions-server";
import { getTenantContext } from "@/lib/tenant/context";

// Détail des dettes (M33) : contrairement à /api/pos/customers (snapshot
// synchronisé pour la vente hors ligne), ce détail n'est consulté qu'à la
// demande, en ligne — même compromis que "Imprimer le ticket" côté caisse,
// pas critique au chemin de vente hors ligne. pos:sell suffit (pas de
// customers:read) : le solde d'un client est déjà visible à l'encaissement
// sans permission supplémentaire, ceci n'expose rien de plus qu'un détail
// de ce même solde.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ customerId: string }> },
) {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "pos:sell");

  const { customerId } = await params;

  const entries = await withTenantContext({ organizationId: ctx.organizationId }, (tx) =>
    tx.customerLedger.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
    }),
  );

  return NextResponse.json({
    entries: entries.map((e) => ({
      id: e.id,
      type: e.type,
      montant: Number(e.montant),
      motif: e.motif,
      createdAt: e.createdAt.toISOString(),
    })),
  });
}
