"use client";

import { ArrowLeft, Receipt } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney } from "@/lib/money";
import type { PosCustomer } from "@/lib/pos/db";

const LEDGER_TYPE_LABELS: Record<string, string> = {
  VENTE_ARDOISE: "Vente à crédit",
  PAIEMENT: "Paiement",
  AJUSTEMENT: "Ajustement",
  ANNULATION_VENTE: "Annulation de vente",
  UTILISATION_BON_ACHAT: "Utilisation bon d'achat",
};

type LedgerEntry = {
  id: string;
  type: string;
  montant: number;
  motif: string | null;
  createdAt: string;
};

export function DebtsDialog({ customers, devise }: { customers: PosCustomer[]; devise: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PosCustomer | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debtorsCount = customers.filter((c) => c.solde > 0).length;

  const indebted = customers
    .filter((c) => c.solde > 0)
    .filter((c) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return c.nom.toLowerCase().includes(q) || (c.telephone ?? "").includes(q);
    })
    .sort((a, b) => b.solde - a.solde);

  async function openCustomer(customer: PosCustomer) {
    setSelected(customer);
    setEntries(null);
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/pos/customers/${customer.id}/ledger`);
      const data = (await res.json()) as { entries?: LedgerEntry[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Échec du chargement du détail.");
        return;
      }
      setEntries(data.entries ?? []);
    } catch {
      setError("Échec du chargement du détail — vérifiez la connexion.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setSelected(null);
    setEntries(null);
    setError(null);
    setQuery("");
  }

  return (
    <>
      <div className="relative">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
          <Receipt className="size-4" />
          Dettes
        </Button>
        {debtorsCount > 0 && (
          <span className="num absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
            {debtorsCount}
          </span>
        )}
      </div>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
        <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{selected ? selected.nom : "Clients avec une dette"}</DialogTitle>
        </DialogHeader>

        {!selected ? (
          <div className="flex flex-col gap-3">
            <Input
              autoFocus
              placeholder="Nom ou téléphone"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="max-h-96 overflow-y-auto rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Solde dû</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {indebted.map((c) => (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer"
                      onClick={() => openCustomer(c)}
                    >
                      <TableCell className="text-foreground">
                        {c.nom}
                        {c.telephone && (
                          <span className="text-muted-foreground"> — {c.telephone}</span>
                        )}
                      </TableCell>
                      <TableCell
                        className={`num text-right ${c.solde > c.plafondCredit ? "text-destructive" : "text-foreground"}`}
                      >
                        {formatMoney(c.solde, devise)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {indebted.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground">
                        Aucun client avec une dette.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="w-fit gap-1.5"
              onClick={() => {
                setSelected(null);
                setEntries(null);
                setError(null);
              }}
            >
              <ArrowLeft className="size-4" />
              Retour à la liste
            </Button>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase">Solde actuel</p>
                <p
                  className={`num text-2xl font-semibold ${selected.solde > selected.plafondCredit ? "text-destructive" : "text-foreground"}`}
                >
                  {formatMoney(selected.solde, devise)}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase">
                  Plafond de crédit
                </p>
                <p className="num text-2xl font-semibold text-foreground">
                  {formatMoney(selected.plafondCredit, devise)}
                </p>
              </div>
            </div>

            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="max-h-80 overflow-y-auto rounded-xl border border-border">
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
                  {entries?.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleDateString("fr-FR")}
                      </TableCell>
                      <TableCell className="text-foreground">
                        {LEDGER_TYPE_LABELS[entry.type] ?? entry.type}
                      </TableCell>
                      <TableCell
                        className={`num text-right ${entry.montant > 0 ? "text-destructive" : "text-success"}`}
                      >
                        {formatMoney(entry.montant, devise)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{entry.motif ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        Chargement...
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading && entries?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        Aucun mouvement pour l&apos;instant.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
        </DialogContent>
      </Dialog>
    </>
  );
}
