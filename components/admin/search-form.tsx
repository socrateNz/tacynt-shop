import Link from "next/link";
import type { ReactNode } from "react";
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Recherche d'une liste rendue côté serveur : simple formulaire GET (?q=…),
 * fonctionne sans JavaScript. `children` : filtres supplémentaires
 * (champs du même formulaire) placés à droite.
 */
export function SearchForm({
  query,
  placeholder,
  resetHref,
  children,
}: {
  query: string;
  placeholder: string;
  /** URL de la liste sans recherche (bouton « Effacer »). */
  resetHref: string;
  children?: ReactNode;
}) {
  return (
    <form
      method="get"
      role="search"
      className="no-print flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-card sm:flex-row sm:flex-wrap sm:items-center"
    >
      <div className="relative min-w-0 flex-1 sm:max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-subtle-foreground" />
        <Input
          name="q"
          type="search"
          defaultValue={query}
          placeholder={placeholder}
          aria-label={placeholder}
          className="pl-8"
        />
      </div>
      {children}
      <div className="flex gap-2 sm:ml-auto">
        {query ? (
          <Link
            href={resetHref}
            className="inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" aria-hidden />
            Effacer
          </Link>
        ) : null}
        <Button type="submit" variant="outline">
          Rechercher
        </Button>
      </div>
    </form>
  );
}

/** Filtre texte insensible à la casse et aux espaces des numéros. */
export function matchesQuery(query: string, ...fields: (string | null | undefined)[]): boolean {
  const term = query.trim().toLowerCase();
  if (!term) return true;
  const compact = term.replace(/\s/g, "");
  return fields.some((f) => {
    if (!f) return false;
    const value = f.toLowerCase();
    return value.includes(term) || value.replace(/\s/g, "").includes(compact);
  });
}
