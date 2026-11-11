"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

const formatter = new Intl.NumberFormat("fr-FR");

/**
 * Pagination côté client d'une liste déjà chargée. `resetOn` : valeurs
 * (recherche, filtres…) dont le changement ramène à la première page.
 */
export function usePagination<T>(items: T[], pageSize: number, resetOn: unknown[] = []) {
  const key = JSON.stringify(resetOn);
  const [state, setState] = useState({ page: 1, key });
  // Ajustement pendant le rendu (patron React documenté) plutôt qu'un effet.
  if (state.key !== key) setState({ page: 1, key });
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(state.key === key ? state.page : 1, pageCount);
  return {
    rows: items.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageCount,
    pageSize,
    total: items.length,
    setPage: (next: number) => setState({ page: Math.min(Math.max(next, 1), pageCount), key }),
  };
}

/** Pied de tableau : « 1–20 sur 134 » + page précédente / suivante. */
export function Pagination({
  page,
  pageCount,
  pageSize,
  total,
  setPage,
  unit,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  setPage: (page: number) => void;
  /** [singulier, pluriel] — ex. ["produit", "produits"]. */
  unit?: [string, string];
}) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <>
      <p className="tabular-nums">
        {pageCount > 1 ? `${formatter.format(from)}–${formatter.format(to)} sur ` : ""}
        {formatter.format(total)}
        {unit ? ` ${total > 1 ? unit[1] : unit[0]}` : ""}
      </p>
      {pageCount > 1 && (
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setPage(page - 1)}
            disabled={page <= 1}
            aria-label="Page précédente"
          >
            <ChevronLeft />
          </Button>
          <span className="min-w-16 text-center tabular-nums">
            {page} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setPage(page + 1)}
            disabled={page >= pageCount}
            aria-label="Page suivante"
          >
            <ChevronRight />
          </Button>
        </div>
      )}
    </>
  );
}
