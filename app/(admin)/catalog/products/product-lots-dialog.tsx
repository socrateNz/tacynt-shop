"use client";

import Link from "next/link";

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

export type ProductLotRow = {
  id: string;
  attrLabel: string;
  numero: string;
  peremptionLabel: string;
  expired: boolean;
  quantite: string;
};

export function ProductLotsDialog({
  productDesignation,
  lots,
}: {
  productDesignation: string;
  lots: ProductLotRow[];
}) {
  return (
    <Dialog>
      <DialogTrigger
        render={<button type="button" className="text-sm text-primary underline-offset-4 hover:underline" />}
      >
        Voir les lots
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Lots — {productDesignation}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Un lot se crée en réceptionnant du stock avec un numéro de lot (
          <Link href="/stock/movements" className="text-primary underline-offset-4 hover:underline">
            Stock → Réception
          </Link>
          ).
        </p>

        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Variante</TableHead>
                <TableHead>N° de lot</TableHead>
                <TableHead>Péremption</TableHead>
                <TableHead className="text-right">Quantité restante</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lots.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-foreground">
                    {l.attrLabel || productDesignation}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{l.numero}</TableCell>
                  <TableCell className={l.expired ? "text-destructive" : "text-muted-foreground"}>
                    {l.peremptionLabel}
                    {l.expired ? " (périmé)" : ""}
                  </TableCell>
                  <TableCell className="num text-right">{l.quantite}</TableCell>
                </TableRow>
              ))}
              {lots.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Aucun lot pour l&apos;instant.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
