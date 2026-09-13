"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { sendPurchaseOrder } from "./purchase-order-actions";
import { PurchaseOrderForm } from "./po-form";
import { PurchaseOrderReceiveDialog, type ReceiveLine } from "./purchase-order-receive-dialog";

const STATUS_LABELS: Record<string, string> = {
  BROUILLON: "Brouillon",
  ENVOYEE: "Envoyée",
  RECUE_PARTIELLE: "Reçue partiellement",
  RECUE_COMPLETE: "Reçue complète",
  ANNULEE: "Annulée",
};

export type PurchaseOrderRow = {
  id: string;
  numero: string;
  statut: string;
  dateLabel: string;
  lines: ReceiveLine[];
};

export function PurchaseOrdersDialog({
  supplierId,
  supplierNom,
  purchaseOrders,
  reorderCandidates,
  products,
}: {
  supplierId: string;
  supplierNom: string;
  purchaseOrders: PurchaseOrderRow[];
  reorderCandidates: { label: string; quantite: number; seuil: number }[];
  products: { variantId: string; label: string; prixAchatDernier: number }[];
}) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Commandes</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Commandes — {supplierNom}</DialogTitle>
        </DialogHeader>

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
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchaseOrders.map((po) => (
                <TableRow key={po.id}>
                  <TableCell className="text-foreground">{po.numero}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {STATUS_LABELS[po.statut] ?? po.statut}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{po.dateLabel}</TableCell>
                  <TableCell className="flex justify-end gap-2">
                    {po.statut === "BROUILLON" && (
                      <form action={sendPurchaseOrder}>
                        <input type="hidden" name="purchaseOrderId" value={po.id} />
                        <Button type="submit" variant="outline" size="sm">
                          Envoyer
                        </Button>
                      </form>
                    )}
                    <PurchaseOrderReceiveDialog
                      purchaseOrderId={po.id}
                      numero={po.numero}
                      supplierNom={supplierNom}
                      statut={po.statut}
                      lines={po.lines}
                    />
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

        <PurchaseOrderForm supplierId={supplierId} products={products} />
      </DialogContent>
    </Dialog>
  );
}
