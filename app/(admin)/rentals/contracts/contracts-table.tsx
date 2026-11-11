"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";

import { TablePanel, Toolbar } from "@/components/admin/page";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PhoneLink } from "@/components/phone-link";
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
  telephoneClient: string;
  statut: string;
  dureeMois: number;
  montantMensuelLabel: string;
  dateDebutLabel: string;
};

export function ContractsTable({ contracts }: { contracts: ContractRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return contracts.filter((c) => {
      if (
        term &&
        !c.numero.toLowerCase().includes(term) &&
        !c.nomClient.toLowerCase().includes(term) &&
        !c.telephoneClient.replace(/\s/g, "").includes(term.replace(/\s/g, "")) &&
        !c.unitDesignation.toLowerCase().includes(term)
      ) {
        return false;
      }
      if (statusFilter !== "all" && c.statut !== statusFilter) return false;
      return true;
    });
  }, [contracts, search, statusFilter]);

  return (
    <div className="flex flex-col gap-4">
      <Toolbar>
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-subtle-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            type="search"
            placeholder="Numéro, client, téléphone, logement…"
            aria-label="Rechercher une location"
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(String(v))}>
          <SelectTrigger aria-label="Statut" className="sm:ml-auto">
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
      </Toolbar>

      <TablePanel>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Numéro</TableHead>
              <TableHead>Logement</TableHead>
              <TableHead className="hidden xl:table-cell">Boutique</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="hidden md:table-cell">Durée</TableHead>
              <TableHead className="text-right">Loyer / mois</TableHead>
              <TableHead className="hidden lg:table-cell">Début</TableHead>
              <TableHead className="w-10">
                <span className="sr-only">Ouvrir</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((c) => (
              <TableRow key={c.id} className="cursor-pointer" onClick={() => router.push(`/rentals/contracts/${c.id}`)}>
                <TableCell>
                  <Link
                    href={`/rentals/contracts/${c.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="num font-medium text-foreground hover:text-primary hover:underline"
                  >
                    {c.numero}
                  </Link>
                </TableCell>
                <TableCell className="text-foreground">{c.unitDesignation}</TableCell>
                <TableCell className="hidden text-muted-foreground xl:table-cell">{c.shopNom}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-muted-foreground">{c.nomClient}</span>
                    <PhoneLink telephone={c.telephoneClient} className="text-xs" />
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_BADGE_VARIANT[c.statut] ?? "secondary"}>
                    {STATUS_LABELS[c.statut] ?? c.statut}
                  </Badge>
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">{c.dureeMois} mois</TableCell>
                <TableCell className="num text-right">{c.montantMensuelLabel}</TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">{c.dateDebutLabel}</TableCell>
                <TableCell>
                  <ChevronRight className="ml-auto size-4 text-muted-foreground" aria-hidden />
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                  Aucune location ne correspond à ces critères.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TablePanel>
    </div>
  );
}
