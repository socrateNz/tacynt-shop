"use client";

import { Eye } from "lucide-react";
import Link from "next/link";

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

import { cancelOrder, confirmOrder } from "./actions";
import { FulfillForm } from "./fulfill-form";

const STATUS_LABELS: Record<string, string> = {
  EN_ATTENTE: "En attente",
  CONFIRMEE: "Confirmée",
  PRETE: "Prête",
  RECUPEREE: "Récupérée",
  ANNULEE: "Annulée",
};

const MODE_LABELS: Record<string, string> = {
  RETRAIT_BOUTIQUE: "Retrait en boutique",
  LIVRAISON: "Livraison",
};

export type OnlineOrderLine = {
  id: string;
  designation: string;
  quantite: number;
  prixUnitaireLabel: string;
};

export function OnlineOrderDialog({
  orderId,
  numero,
  statut,
  shopNom,
  nomClient,
  telephoneClient,
  modeRetrait,
  adresseLivraison,
  notes,
  lines,
  totalTtc,
  totalTtcLabel,
  saleId,
}: {
  orderId: string;
  numero: string;
  statut: string;
  shopNom: string;
  nomClient: string;
  telephoneClient: string;
  modeRetrait: string;
  adresseLivraison: string | null;
  notes: string | null;
  lines: OnlineOrderLine[];
  totalTtc: number;
  totalTtcLabel: string;
  saleId: string | null;
}) {
  const isOpenForAction = statut !== "RECUPEREE" && statut !== "ANNULEE";

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <Eye className="size-3.5" />
        <span className="sr-only">Voir</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Commande {numero}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Statut : {STATUS_LABELS[statut] ?? statut} — {shopNom}
        </p>

        <section className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-card p-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase">Client</p>
            <p className="text-sm text-foreground">{nomClient}</p>
            <p className="text-sm text-muted-foreground">{telephoneClient}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase">Retrait</p>
            <p className="text-sm text-foreground">{MODE_LABELS[modeRetrait] ?? modeRetrait}</p>
            {adresseLivraison && <p className="text-sm text-muted-foreground">{adresseLivraison}</p>}
          </div>
          {notes && (
            <div className="col-span-2">
              <p className="text-xs font-medium text-muted-foreground uppercase">Notes</p>
              <p className="text-sm text-muted-foreground">{notes}</p>
            </div>
          )}
        </section>

        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produit</TableHead>
                <TableHead className="text-right">Quantité</TableHead>
                <TableHead className="text-right">Prix unitaire</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-foreground">{l.designation}</TableCell>
                  <TableCell className="num text-right">{l.quantite}</TableCell>
                  <TableCell className="num text-right">{l.prixUnitaireLabel}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-end">
          <p className="num text-lg font-semibold text-foreground">Total : {totalTtcLabel}</p>
        </div>

        {isOpenForAction && (
          <>
            <div className="flex gap-2">
              {statut === "EN_ATTENTE" && (
                <form action={confirmOrder}>
                  <input type="hidden" name="orderId" value={orderId} />
                  <Button type="submit">Confirmer la commande</Button>
                </form>
              )}
              <form action={cancelOrder}>
                <input type="hidden" name="orderId" value={orderId} />
                <Button type="submit" variant="ghost">
                  Annuler
                </Button>
              </form>
            </div>

            <FulfillForm orderId={orderId} totalTtc={totalTtc} />
          </>
        )}

        {statut === "RECUPEREE" && saleId && (
          <p className="text-sm text-muted-foreground">
            Encaissée — vente correspondante visible dans{" "}
            <Link href="/sales" className="text-primary underline-offset-4 hover:underline">
              Ventes
            </Link>
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
