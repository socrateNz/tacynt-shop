import Link from "next/link";
import { notFound } from "next/navigation";

import { withTenantContext } from "@/lib/db/tenant-context";
import { formatMoney } from "@/lib/money";
import { getStorefrontOrganization } from "@/lib/storefront/context";

const STATUS_LABELS: Record<string, string> = {
  EN_ATTENTE: "En attente de confirmation",
  CONFIRMEE: "Confirmée",
  PRETE: "Prête",
  RECUPEREE: "Récupérée",
  ANNULEE: "Annulée",
};

export default async function MerciPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const organization = await getStorefrontOrganization();
  if (!organization) {
    notFound();
  }

  const { orderId } = await params;

  // Scopé à l'organisation résolue par host : un id de commande d'une autre
  // organisation ne matche simplement aucune ligne (isolation héritée de la
  // RLS, même principe que expenses/[expenseId]/attachment).
  const order = await withTenantContext({ organizationId: organization.id }, (tx) =>
    tx.onlineOrder.findUnique({ where: { id: orderId } }),
  );

  if (!order) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Commande enregistrée</h1>
        <p className="text-sm text-muted-foreground">
          Numéro {order.numero} — {STATUS_LABELS[order.statut] ?? order.statut}
        </p>
      </header>

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="num text-lg font-semibold text-foreground">
          Total : {formatMoney(order.totalTtc, organization.devise)}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Paiement à la réception, comme convenu — vous serez contacté(e) au{" "}
          {order.telephoneClient} pour la suite.
        </p>
      </div>

      <Link href="/boutique" className="text-sm text-primary underline-offset-4 hover:underline">
        ← Retour au catalogue
      </Link>
    </div>
  );
}
