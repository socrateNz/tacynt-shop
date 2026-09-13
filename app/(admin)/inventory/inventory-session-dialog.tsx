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
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { cancelInventorySession, validateInventorySession } from "./session-actions";
import { CountRow } from "./count-row";

export type InventoryCountRow = {
  variantId: string;
  designation: string;
  quantiteTheoriqueActuelle: number;
  existingCount: { quantiteTheorique: number; quantiteComptee: number | null } | null;
};

export function InventorySessionDialog({
  sessionId,
  title,
  statut,
  countedLines,
  totalLines,
  rows,
}: {
  sessionId: string;
  title: string;
  statut: string;
  countedLines: number;
  totalLines: number;
  rows: InventoryCountRow[];
}) {
  const readOnly = statut !== "EN_COURS";

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <Eye className="size-3.5" />
        <span className="sr-only">Voir</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {countedLines} / {totalLines} ligne(s) comptée(s) — statut : {statut}
        </p>

        {statut === "EN_COURS" && (
          <div className="flex gap-2">
            <form action={validateInventorySession}>
              <input type="hidden" name="inventorySessionId" value={sessionId} />
              <Button type="submit">Valider l&apos;inventaire</Button>
            </form>
            <form action={cancelInventorySession}>
              <input type="hidden" name="inventorySessionId" value={sessionId} />
              <Button type="submit" variant="ghost">
                Annuler
              </Button>
            </form>
          </div>
        )}

        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produit</TableHead>
                <TableHead className="text-right">Théorique</TableHead>
                <TableHead className="text-right">Compté</TableHead>
                <TableHead className="text-right">Écart</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <CountRow
                  key={r.variantId}
                  inventorySessionId={sessionId}
                  variantId={r.variantId}
                  designation={r.designation}
                  quantiteTheoriqueActuelle={r.quantiteTheoriqueActuelle}
                  existingCount={r.existingCount}
                  readOnly={readOnly}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
