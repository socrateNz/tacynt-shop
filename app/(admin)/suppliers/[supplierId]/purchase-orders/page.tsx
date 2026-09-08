import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { withTenantContext } from "@/lib/db/tenant-context";
import { hasCapability } from "@/lib/permissions";
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";

import { sendPurchaseOrder } from "./actions";
import { PurchaseOrderForm } from "./po-form";

const STATUS_LABELS: Record<string, string> = {
  BROUILLON: "Brouillon",
  ENVOYEE: "Envoyée",
  RECUE_PARTIELLE: "Reçue partiellement",
  RECUE_COMPLETE: "Reçue complète",
  ANNULEE: "Annulée",
};

export default async function SupplierPurchaseOrdersPage({
  params,
}: {
  params: Promise<{ supplierId: string }>;
}) {
  const ctx = await getTenantContext();
  if (!hasCapability(ctx.role, "purchasing:manage")) {
    redirect("/");
  }

  const { supplierId } = await params;
  const shopId = await getActiveShopId(ctx.organizationId, ctx.userId);

  const [supplier, purchaseOrders, supplierProducts, reorderCandidates] = await withTenantContext(
    { organizationId: ctx.organizationId, shopId },
    async (tx) => {
      const supplier = await tx.supplier.findUniqueOrThrow({ where: { id: supplierId } });
      const purchaseOrders = await tx.purchaseOrder.findMany({
        where: { supplierId },
        orderBy: { createdAt: "desc" },
      });
      const supplierProducts = await tx.supplierProduct.findMany({
        where: { supplierId },
        include: { variant: { include: { product: true } } },
      });

      // Suggestion de réapprovisionnement : calculée à la lecture, jamais
      // stockée (section M14) — stock actuel <= seuil d'alerte configuré.
      const reorderCandidates: { label: string; quantite: number; seuil: number }[] = [];
      for (const sp of supplierProducts) {
        const [stockLevel, shopPrice] = await Promise.all([
          tx.stockLevel.findUnique({
            where: { variantId_shopId: { variantId: sp.variantId, shopId } },
          }),
          tx.shopPrice.findUnique({
            where: { variantId_shopId: { variantId: sp.variantId, shopId } },
          }),
        ]);
        const quantite = stockLevel ? Number(stockLevel.quantite) : 0;
        const seuil = shopPrice?.seuilAlerte ?? null;
        if (seuil !== null && quantite <= seuil) {
          reorderCandidates.push({ label: sp.variant.product.designation, quantite, seuil });
        }
      }

      return [supplier, purchaseOrders, supplierProducts, reorderCandidates] as const;
    },
  );

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-xl font-semibold text-foreground">
          Commandes — {supplier.nom}
        </h1>
        <Link
          href={`/suppliers/${supplier.id}`}
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          ← Retour au fournisseur
        </Link>
      </header>

      {reorderCandidates.length > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-4">
          <p className="text-sm font-medium text-foreground">Suggestions de réapprovisionnement</p>
          <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
            {reorderCandidates.map((c) => (
              <li key={c.label}>
                {c.label} — stock {c.quantite} (seuil {c.seuil})
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Numéro</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Date</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {purchaseOrders.map((po) => (
              <TableRow key={po.id}>
                <TableCell className="text-foreground">{po.numero}</TableCell>
                <TableCell className="text-muted-foreground">
                  {STATUS_LABELS[po.statut] ?? po.statut}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {po.createdAt.toLocaleDateString("fr-FR")}
                </TableCell>
                <TableCell className="flex justify-end gap-2">
                  {po.statut === "BROUILLON" && (
                    <form action={sendPurchaseOrder}>
                      <input type="hidden" name="purchaseOrderId" value={po.id} />
                      <input type="hidden" name="supplierId" value={supplier.id} />
                      <Button type="submit" variant="outline" size="sm">
                        Envoyer
                      </Button>
                    </form>
                  )}
                  {(po.statut === "ENVOYEE" || po.statut === "RECUE_PARTIELLE") && (
                    <Link href={`/purchase-orders/${po.id}/receive`}>
                      <Button type="button" variant="outline" size="sm">
                        Recevoir
                      </Button>
                    </Link>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {purchaseOrders.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Aucune commande pour l&apos;instant.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <PurchaseOrderForm
        supplierId={supplier.id}
        products={supplierProducts.map((sp) => ({
          variantId: sp.variantId,
          label: sp.variant.product.designation,
          prixAchatDernier: Number(sp.prixAchatDernier),
        }))}
      />
    </div>
  );
}
