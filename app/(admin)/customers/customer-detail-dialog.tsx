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

import { CustomerSettingsForm, LoyaltyConversionForm, PaymentForm } from "./customer-detail-forms";

const LEDGER_TYPE_LABELS: Record<string, string> = {
  VENTE_ARDOISE: "Vente à crédit",
  PAIEMENT: "Paiement",
  AJUSTEMENT: "Ajustement",
  ANNULATION_VENTE: "Annulation de vente",
  UTILISATION_BON_ACHAT: "Utilisation bon d'achat",
};

export type CustomerLedgerRow = {
  id: string;
  createdAtLabel: string;
  type: string;
  montant: number;
  montantLabel: string;
  motif: string | null;
};

export function CustomerDetailDialog({
  customerId,
  nom,
  telephone,
  categorieTarif,
  plafondCredit,
  plafondCreditLabel,
  soldeLabel,
  pointsBalance,
  overLimit,
  ledgerEntries,
  actif,
}: {
  customerId: string;
  nom: string;
  telephone: string | null;
  categorieTarif: string;
  plafondCredit: number;
  plafondCreditLabel: string;
  soldeLabel: string;
  pointsBalance: number;
  overLimit: boolean;
  ledgerEntries: CustomerLedgerRow[];
  actif: boolean;
}) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <Eye className="size-3.5" />
        <span className="sr-only">Voir</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{nom}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{telephone ?? "Aucun téléphone"}</p>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase">Solde actuel</p>
            <p
              className={`num text-2xl font-semibold ${overLimit ? "text-destructive" : "text-foreground"}`}
            >
              {soldeLabel}
            </p>
            {overLimit && (
              <p className="mt-1 text-xs text-destructive">
                Plafond dépassé ({plafondCreditLabel}).
              </p>
            )}
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase">
              Plafond de crédit
            </p>
            <p className="num text-2xl font-semibold text-foreground">{plafondCreditLabel}</p>
          </div>
        </div>

        <PaymentForm customerId={customerId} />
        <LoyaltyConversionForm customerId={customerId} pointsBalance={pointsBalance} />
        <CustomerSettingsForm
          customerId={customerId}
          categorieTarif={categorieTarif}
          plafondCredit={plafondCredit}
          actif={actif}
        />

        <section className="flex flex-col gap-4">
          <h3 className="text-sm font-medium text-foreground">Historique</h3>
          <div className="rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Motif</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledgerEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-muted-foreground">
                      {entry.createdAtLabel}
                    </TableCell>
                    <TableCell className="text-foreground">
                      {LEDGER_TYPE_LABELS[entry.type] ?? entry.type}
                    </TableCell>
                    <TableCell
                      className={`num text-right ${entry.montant > 0 ? "text-destructive" : "text-success"}`}
                    >
                      {entry.montantLabel}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{entry.motif ?? "—"}</TableCell>
                  </TableRow>
                ))}
                {ledgerEntries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Aucun mouvement pour l&apos;instant.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}
