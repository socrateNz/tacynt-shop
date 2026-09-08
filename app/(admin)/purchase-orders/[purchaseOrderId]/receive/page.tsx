import Link from "next/link";
import { redirect } from "next/navigation";

import { withTenantContext } from "@/lib/db/tenant-context";
import { hasCapability } from "@/lib/permissions";
import { getTenantContext } from "@/lib/tenant/context";

import { ReceiveForm } from "./receive-form";

const STATUS_LABELS: Record<string, string> = {
  BROUILLON: "Brouillon",
  ENVOYEE: "Envoyée",
  RECUE_PARTIELLE: "Reçue partiellement",
  RECUE_COMPLETE: "Reçue complète",
  ANNULEE: "Annulée",
};

export default async function ReceivePurchaseOrderPage({
  params,
}: {
  params: Promise<{ purchaseOrderId: string }>;
}) {
  const ctx = await getTenantContext();
  if (!hasCapability(ctx.role, "purchasing:manage")) {
    redirect("/");
  }

  const { purchaseOrderId } = await params;

  const { po, lines } = await withTenantContext(
    { organizationId: ctx.organizationId },
    async (tx) => {
      const po = await tx.purchaseOrder.findUniqueOrThrow({
        where: { id: purchaseOrderId },
        include: { supplier: true, lines: { include: { variant: { include: { product: true } } } } },
      });

      const receiptLines = await tx.goodsReceiptLine.findMany({
        where: { goodsReceipt: { purchaseOrderId: po.id } },
      });
      const receivedByVariant = new Map<string, number>();
      for (const l of receiptLines) {
        receivedByVariant.set(
          l.variantId,
          (receivedByVariant.get(l.variantId) ?? 0) + Number(l.quantiteRecue),
        );
      }

      const lines = po.lines.map((l) => ({
        variantId: l.variantId,
        designation: l.variant.product.designation,
        quantiteCommandee: Number(l.quantiteCommandee),
        dejaRecue: receivedByVariant.get(l.variantId) ?? 0,
        prixUnitaireCommande: Number(l.prixUnitaireCommande),
      }));

      return { po, lines };
    },
  );

  const fullyReceived = po.statut === "RECUE_COMPLETE";

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-xl font-semibold text-foreground">
          Réception — {po.numero} ({po.supplier.nom})
        </h1>
        <p className="text-sm text-muted-foreground">
          Statut : {STATUS_LABELS[po.statut] ?? po.statut}
        </p>
        <Link
          href={`/suppliers/${po.supplierId}/purchase-orders`}
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          ← Retour aux commandes
        </Link>
      </header>

      {fullyReceived ? (
        <p className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          Cette commande a été intégralement reçue.
        </p>
      ) : (
        <ReceiveForm purchaseOrderId={po.id} lines={lines} />
      )}
    </div>
  );
}
