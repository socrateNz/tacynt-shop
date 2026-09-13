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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { cancelTransfer } from "./transfer-detail-actions";
import { ReceiveForm } from "./receive-form";
import { ShipForm } from "./ship-form";

const STATUS_LABELS: Record<string, string> = {
  DEMANDE: "Demandé",
  EXPEDIE: "Expédié (en transit)",
  RECU: "Reçu",
  ANNULE: "Annulé",
};

export type TransferLineRow = {
  id: string;
  designation: string;
  quantiteDemandee: number;
  quantiteExpediee: number | null;
  quantiteRecue: number | null;
};

export function TransferDialog({
  transferId,
  numero,
  fromShopNom,
  toShopNom,
  statut,
  lines,
}: {
  transferId: string;
  numero: string;
  fromShopNom: string;
  toShopNom: string;
  statut: string;
  lines: TransferLineRow[];
}) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <Eye className="size-3.5" />
        <span className="sr-only">Voir</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Transfert {numero} — {fromShopNom} → {toShopNom}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Statut : {STATUS_LABELS[statut] ?? statut}
        </p>

        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produit</TableHead>
                <TableHead className="text-right">Demandé</TableHead>
                <TableHead className="text-right">Expédié</TableHead>
                <TableHead className="text-right">Reçu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((l) => {
                const ecart =
                  l.quantiteRecue !== null && l.quantiteExpediee !== null
                    ? l.quantiteRecue - l.quantiteExpediee
                    : null;
                return (
                  <TableRow key={l.id}>
                    <TableCell className="text-foreground">{l.designation}</TableCell>
                    <TableCell className="num text-right">{l.quantiteDemandee}</TableCell>
                    <TableCell className="num text-right">
                      {l.quantiteExpediee ?? "—"}
                    </TableCell>
                    <TableCell
                      className={`num text-right ${ecart !== null && ecart !== 0 ? "text-destructive" : ""}`}
                    >
                      {l.quantiteRecue ?? "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {statut === "DEMANDE" && (
          <>
            <ShipForm
              transferId={transferId}
              lines={lines.map((l) => ({
                lineId: l.id,
                designation: l.designation,
                quantiteDemandee: l.quantiteDemandee,
              }))}
            />
            <form action={cancelTransfer}>
              <input type="hidden" name="transferId" value={transferId} />
              <Button type="submit" variant="ghost">
                Annuler la demande
              </Button>
            </form>
          </>
        )}

        {statut === "EXPEDIE" && (
          <ReceiveForm
            transferId={transferId}
            lines={lines.map((l) => ({
              lineId: l.id,
              designation: l.designation,
              quantiteExpediee: l.quantiteExpediee ?? 0,
            }))}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
