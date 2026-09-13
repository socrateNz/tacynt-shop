"use client";

import { useState } from "react";
import { Eye } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { PrintableTicket, type TicketData } from "@/app/(pos)/caisse/printable-ticket";
import { CancelSaleForm } from "./cancel-sale-form";

export type SaleRow = {
  id: string;
  numero: string;
  createdAtLabel: string;
  totalLabel: string;
  statut: "VALIDEE" | "ANNULEE";
  customerNom: string | null;
  ticket: TicketData;
};

export function SalesTable({
  sales,
  canCancel,
}: {
  sales: SaleRow[];
  canCancel: boolean;
}) {
  const [openSaleId, setOpenSaleId] = useState<string | null>(null);
  const openSale = sales.find((s) => s.id === openSaleId) ?? null;

  return (
    <>
      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Numéro</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Statut</TableHead>
              {canCancel && <TableHead>Annuler</TableHead>}
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="num text-foreground">{s.numero}</TableCell>
                <TableCell className="text-muted-foreground">{s.createdAtLabel}</TableCell>
                <TableCell className="num text-right">{s.totalLabel}</TableCell>
                <TableCell>
                  <Badge variant={s.statut === "VALIDEE" ? "success" : "destructive"}>
                    {s.statut === "VALIDEE" ? "Validée" : "Annulée"}
                  </Badge>
                </TableCell>
                {canCancel && (
                  <TableCell>{s.statut === "VALIDEE" && <CancelSaleForm saleId={s.id} />}</TableCell>
                )}
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setOpenSaleId(s.id)}
                  >
                    <Eye className="size-3.5" />
                    <span className="sr-only">Voir</span>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {sales.length === 0 && (
              <TableRow>
                <TableCell colSpan={canCancel ? 6 : 5} className="text-center text-muted-foreground">
                  Aucune vente pour l&apos;instant.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={openSale !== null} onOpenChange={(open) => !open && setOpenSaleId(null)}>
        <DialogContent className="sm:max-w-sm">
          {openSale && (
            <>
              <DialogHeader>
                <DialogTitle>Ticket {openSale.numero}</DialogTitle>
              </DialogHeader>
              {openSale.customerNom && (
                <p className="text-sm text-muted-foreground">Client : {openSale.customerNom}</p>
              )}
              <PrintableTicket ticket={openSale.ticket} />
              {canCancel && openSale.statut === "VALIDEE" && (
                <CancelSaleForm saleId={openSale.id} />
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
