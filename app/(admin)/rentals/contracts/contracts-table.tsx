"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_LABELS: Record<string, string> = {
  DEMANDE: "Demande",
  CONFIRMEE: "Confirmée",
  EN_COURS: "En cours",
  TERMINEE: "Terminée",
  ANNULEE: "Annulée",
};

const STATUS_BADGE_VARIANT: Record<string, "secondary" | "success" | "destructive"> = {
  DEMANDE: "secondary",
  CONFIRMEE: "secondary",
  EN_COURS: "success",
  TERMINEE: "secondary",
  ANNULEE: "destructive",
};

export type ContractRow = {
  id: string;
  numero: string;
  unitDesignation: string;
  shopNom: string;
  nomClient: string;
  statut: string;
  dureeMois: number;
  montantMensuelLabel: string;
  dateDebutLabel: string;
};

export function ContractsTable({ contracts }: { contracts: ContractRow[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return contracts.filter((c) => {
      if (
        term &&
        !c.numero.toLowerCase().includes(term) &&
        !c.nomClient.toLowerCase().includes(term) &&
        !c.unitDesignation.toLowerCase().includes(term)
      ) {
        return false;
      }
      if (statusFilter !== "all" && c.statut !== statusFilter) return false;
      return true;
    });
  }, [contracts, search, statusFilter]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-subtle-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un numéro, client, logement..."
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(String(v))}>
          <SelectTrigger>
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Numéro</TableHead>
              <TableHead>Logement</TableHead>
              <TableHead>Boutique</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Durée</TableHead>
              <TableHead className="text-right">Loyer / mois</TableHead>
              <TableHead>Début</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <Link
                    href={`/rentals/contracts/${c.id}`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {c.numero}
                  </Link>
                </TableCell>
                <TableCell className="text-foreground">{c.unitDesignation}</TableCell>
                <TableCell className="text-muted-foreground">{c.shopNom}</TableCell>
                <TableCell className="text-muted-foreground">{c.nomClient}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_BADGE_VARIANT[c.statut] ?? "secondary"}>
                    {STATUS_LABELS[c.statut] ?? c.statut}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{c.dureeMois} mois</TableCell>
                <TableCell className="num text-right">{c.montantMensuelLabel}</TableCell>
                <TableCell className="text-muted-foreground">{c.dateDebutLabel}</TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Aucune location pour l&apos;instant.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
