"use client";

import { Eye } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { ReceiveForm } from "./receive-form";

const STATUS_LABELS: Record<string, string> = {
  BROUILLON: "Brouillon",
  ENVOYEE: "Envoyée",
  RECUE_PARTIELLE: "Reçue partiellement",
  RECUE_COMPLETE: "Reçue complète",
  ANNULEE: "Annulée",
};

export type ReceiveLine = {
  variantId: string;
  designation: string;
  quantiteCommandee: number;
  dejaRecue: number;
  prixUnitaireCommande: number;
};

export function PurchaseOrderReceiveDialog({
  purchaseOrderId,
  numero,
  supplierNom,
  statut,
  lines,
}: {
  purchaseOrderId: string;
  numero: string;
  supplierNom: string;
  statut: string;
  lines: ReceiveLine[];
}) {
  const fullyReceived = statut === "RECUE_COMPLETE";

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <Eye className="size-3.5" />
        <span className="sr-only">Voir</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Réception — {numero} ({supplierNom})
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Statut : {STATUS_LABELS[statut] ?? statut}
        </p>

        {fullyReceived ? (
          <p className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
            Cette commande a été intégralement reçue.
          </p>
        ) : (
          <ReceiveForm purchaseOrderId={purchaseOrderId} lines={lines} />
        )}
      </DialogContent>
    </Dialog>
  );
}
