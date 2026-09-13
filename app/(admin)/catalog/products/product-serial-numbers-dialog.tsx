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

export type ProductSerialNumberRow = {
  id: string;
  attrLabel: string;
  numero: string;
  statutLabel: string;
  vendu: boolean;
  receivedAtLabel: string;
  saleNumero: string | null;
};

export function ProductSerialNumbersDialog({
  productDesignation,
  serialNumbers,
}: {
  productDesignation: string;
  serialNumbers: ProductSerialNumberRow[];
}) {
  return (
    <Dialog>
      <DialogTrigger
        render={<button type="button" className="text-sm text-primary underline-offset-4 hover:underline" />}
      >
        Voir les numéros
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Numéros de série — {productDesignation}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Un numéro se crée en réceptionnant du stock avec des numéros de série (
          <Link href="/stock/movements" className="text-primary underline-offset-4 hover:underline">
            Stock → Réception
          </Link>
          ). Affectation à la vente automatique, en FIFO.
        </p>

        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Variante</TableHead>
                <TableHead>N° de série</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Reçu le</TableHead>
                <TableHead>Vente</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {serialNumbers.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="text-foreground">
                    {s.attrLabel || productDesignation}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{s.numero}</TableCell>
                  <TableCell className={s.vendu ? "text-muted-foreground" : "text-foreground"}>
                    {s.statutLabel}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{s.receivedAtLabel}</TableCell>
                  <TableCell className="text-muted-foreground">{s.saleNumero ?? "—"}</TableCell>
                </TableRow>
              ))}
              {serialNumbers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Aucun numéro de série pour l&apos;instant.
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
