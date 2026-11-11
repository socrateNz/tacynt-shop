"use client";

import { useState } from "react";
import { ChevronRight, Download, Printer, ReceiptText } from "lucide-react";

import { EmptyState, TablePanel } from "@/components/admin/page";
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
import { downloadTicketPdf } from "@/lib/pos/ticket-pdf";

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
      <TablePanel>
        {sales.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title="Aucune vente pour l'instant"
            description="Les tickets encaissés à la caisse de cette boutique apparaîtront ici."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead className="hidden sm:table-cell">Client</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map((s) => (
                <TableRow key={s.id} className="cursor-pointer" onClick={() => setOpenSaleId(s.id)}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="num font-medium text-foreground">{s.numero}</span>
                      <span className="text-xs text-muted-foreground">{s.createdAtLabel}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">{s.customerNom ?? "—"}</TableCell>
                  <TableCell className="num text-right">{s.totalLabel}</TableCell>
                  <TableCell>
                    <Badge variant={s.statut === "VALIDEE" ? "success" : "destructive"}>
                      {s.statut === "VALIDEE" ? "Validée" : "Annulée"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <ChevronRight className="ml-auto size-4 text-muted-foreground" aria-hidden />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TablePanel>

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
              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                {canCancel && openSale.statut === "VALIDEE" && <CancelSaleForm saleId={openSale.id} />}
                <div className="ml-auto flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => downloadTicketPdf(openSale.ticket)}>
                    <Download />
                    PDF
                  </Button>
                  <Button size="sm" onClick={() => window.print()}>
                    <Printer />
                    Imprimer
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
