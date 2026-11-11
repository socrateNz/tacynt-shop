"use client";

import { ChevronRight } from "lucide-react";

import { TablePanel } from "@/components/admin/page";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        Ouvrir
        <ChevronRight className="size-3.5" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{nom}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{telephone ?? "Aucun téléphone"}</p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4 shadow-card">
            <p className="text-xs font-medium text-muted-foreground uppercase">Solde actuel</p>
            <p className={`num text-2xl font-semibold ${overLimit ? "text-destructive" : "text-foreground"}`}>
              {soldeLabel}
            </p>
            {overLimit && <p className="mt-1 text-xs text-destructive">Plafond dépassé ({plafondCreditLabel}).</p>}
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-card">
            <p className="text-xs font-medium text-muted-foreground uppercase">Plafond de crédit</p>
            <p className="num text-2xl font-semibold text-foreground">{plafondCreditLabel}</p>
          </div>
        </div>

        <Tabs defaultValue="historique" className="flex flex-col gap-4">
          <TabsList className="max-w-full self-start overflow-x-auto">
            <TabsTab value="historique">Historique</TabsTab>
            <TabsTab value="encaisser">Encaisser</TabsTab>
            <TabsTab value="fidelite">Fidélité</TabsTab>
            <TabsTab value="reglages">Réglages</TabsTab>
          </TabsList>
          <TabsPanel value="historique" className="flex flex-col gap-4">
            <section className="flex flex-col gap-4">
              <TablePanel>
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
                        <TableCell className="text-muted-foreground">{entry.createdAtLabel}</TableCell>
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
              </TablePanel>
            </section>
          </TabsPanel>
          <TabsPanel value="encaisser" className="flex flex-col gap-4">
            <PaymentForm customerId={customerId} />
          </TabsPanel>
          <TabsPanel value="fidelite" className="flex flex-col gap-4">
            <LoyaltyConversionForm customerId={customerId} pointsBalance={pointsBalance} />
          </TabsPanel>
          <TabsPanel value="reglages" className="flex flex-col gap-4">
            <CustomerSettingsForm
              customerId={customerId}
              categorieTarif={categorieTarif}
              plafondCredit={plafondCredit}
              actif={actif}
            />
          </TabsPanel>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
