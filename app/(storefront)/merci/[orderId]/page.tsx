import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { withTenantContext } from "@/lib/db/tenant-context";
import { formatMoney } from "@/lib/money";
import { getStorefrontOrganization } from "@/lib/storefront/context";

import { StorefrontBreadcrumb } from "../../../storefront-breadcrumb";
import { PaymentStatus } from "./payment-status";

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
    tx.onlineOrder.findUnique({
      where: { id: orderId },
      include: {
        shop: true,
        payments: { orderBy: { createdAt: "desc" }, take: 1 },
        // Même patron d'include que app/(admin)/online-orders/page.tsx
        // (designation = variant.product.designation) — pas un nouveau
        // format inventé pour la vitrine.
        lines: {
          include: {
            variant: {
              include: { product: { include: { images: { select: { id: true }, take: 1 } } } },
            },
          },
        },
      },
    }),
  );

  if (!order) {
    notFound();
  }

  const latestPayment = order.payments[0] ?? null;

  return (
    <div className="flex flex-col gap-6">
      <StorefrontBreadcrumb items={[{ label: "Panier", href: "/panier" }, { label: "Confirmation" }]} />

      <header className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/10 p-4">
        <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-success" />
        <div>
          <h1 className="text-xl font-semibold text-success">
            Commande enregistrée avec succès
          </h1>
          <p className="text-sm text-success/80">
            Numéro {order.numero} — {STATUS_LABELS[order.statut] ?? order.statut}
          </p>
        </div>
      </header>

      <div className="rounded-xl border border-border bg-card p-4">
        <ul className="flex flex-col gap-3">
          {order.lines.map((line) => {
            const coverImageId = line.variant.product.images[0]?.id ?? null;
            return (
              <li key={line.id} className="flex items-center gap-3">
                {coverImageId ? (
                  // eslint-disable-next-line @next/next/no-img-element -- image binaire servie par la route, pas un asset statique optimisable
                  <img
                    src={`/api/products/${line.variant.productId}/images/${coverImageId}`}
                    alt=""
                    className="size-10 shrink-0 rounded-md border border-border object-cover"
                  />
                ) : (
                  <div className="size-10 shrink-0 rounded-md border border-dashed border-border" />
                )}
                <span className="min-w-0 flex-1 text-sm text-muted-foreground">
                  {Number(line.quantite)} × {line.variant.product.designation}
                </span>
                <span className="num shrink-0 text-sm text-foreground">
                  {formatMoney(Number(line.prixUnitaire) * Number(line.quantite), organization.devise)}
                </span>
              </li>
            );
          })}
        </ul>

        {order.emballageQuantite > 0 && order.emballagePrixUnitaire !== null && (
          <p className="num mt-3 text-sm text-muted-foreground">
            Emballage : {order.emballageQuantite} ×{" "}
            {formatMoney(order.emballagePrixUnitaire, organization.devise)}
          </p>
        )}
        <p className="num mt-3 border-t border-border pt-3 text-lg font-semibold text-foreground">
          Total : {formatMoney(order.totalTtc, organization.devise)}
        </p>
        {order.shop.paiementEnLigneActif ? (
          <div className="mt-2">
            <PaymentStatus
              orderId={order.id}
              orderConfirmee={order.statut === "CONFIRMEE"}
              statutInitial={latestPayment?.statut ?? null}
            />
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Paiement à la réception, comme convenu — vous serez contacté(e) au{" "}
            {order.telephoneClient} pour la suite.
          </p>
        )}
      </div>

      <Link href="/" className="text-sm text-primary underline-offset-4 hover:underline">
        ← Retour au catalogue
      </Link>
    </div>
  );
}
