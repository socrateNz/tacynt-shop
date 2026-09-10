"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Pencil, Plus, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { ProductForm } from "./product-form";

export type ProductRow = {
  id: string;
  reference: string;
  designation: string;
  categoryName: string | null;
  priceLabel: string;
  priceValue: number;
  stockSuivi: boolean;
  activeVariants: number;
  lotsHref: string | null;
  serialHref: string | null;
};

type SortKey = "designation" | "price-desc" | "variants-desc";

const PAGE_SIZE = 10;

const SORT_LABELS: Record<SortKey, string> = {
  designation: "Désignation (A → Z)",
  "price-desc": "Prix (décroissant)",
  "variants-desc": "Variantes (décroissant)",
};

export function ProductsTable({
  products,
  categories,
  canWrite,
  showLots,
  showSerial,
}: {
  products: ProductRow[];
  categories: { id: string; nom: string }[];
  canWrite: boolean;
  showLots: boolean;
  showSerial: boolean;
}) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("designation");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [formOpen, setFormOpen] = useState(false);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = products.filter((p) => {
      if (
        term &&
        !p.designation.toLowerCase().includes(term) &&
        !p.reference.toLowerCase().includes(term)
      ) {
        return false;
      }
      if (categoryFilter !== "all" && p.categoryName !== categoryFilter) return false;
      if (stockFilter === "tracked" && !p.stockSuivi) return false;
      if (stockFilter === "untracked" && p.stockSuivi) return false;
      return true;
    });

    return [...rows].sort((a, b) => {
      if (sort === "price-desc") return b.priceValue - a.priceValue;
      if (sort === "variants-desc") return b.activeVariants - a.activeVariants;
      return a.designation.localeCompare(b.designation);
    });
  }, [products, search, categoryFilter, stockFilter, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const pageIds = pageRows.map((p) => p.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  function toggleAllOnPage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function goToPage(next: number) {
    setPage(Math.min(Math.max(next, 1), pageCount));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-subtle-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Rechercher un produit..."
            className="pl-8"
          />
        </div>

        <Select
          value={categoryFilter}
          onValueChange={(value) => {
            setCategoryFilter(String(value));
            setPage(1);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Catégorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les catégories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.nom}>
                {c.nom}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={stockFilter}
          onValueChange={(value) => {
            setStockFilter(String(value));
            setPage(1);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Stock" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tout le stock</SelectItem>
            <SelectItem value="tracked">Stock suivi</SelectItem>
            <SelectItem value="untracked">Stock non suivi</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
          <SelectTrigger>
            <SelectValue placeholder="Trier par" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
              <SelectItem key={key} value={key}>
                {SORT_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {canWrite && (
          <Dialog open={formOpen} onOpenChange={setFormOpen}>
            <Button className="ml-auto gap-1.5" onClick={() => setFormOpen(true)}>
              <Plus className="size-4" />
              Ajouter un produit
            </Button>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Nouveau produit</DialogTitle>
              </DialogHeader>
              <ProductForm
                categories={categories}
                showLots={showLots}
                showSerial={showSerial}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {selected.size > 0 && (
        <p className="text-sm text-muted-foreground">{selected.size} sélectionné(s)</p>
      )}

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={allPageSelected} onCheckedChange={toggleAllOnPage} />
              </TableHead>
              <TableHead>Produit</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead className="text-right">Prix de vente</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Variantes</TableHead>
              {showLots && <TableHead>Lots</TableHead>}
              {showSerial && <TableHead>Numéros de série</TableHead>}
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggleOne(p.id)} />
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-foreground">{p.designation}</span>
                    <span className="num text-xs text-subtle-foreground">SKU: {p.reference}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{p.categoryName ?? "—"}</TableCell>
                <TableCell className="num text-right">{p.priceLabel}</TableCell>
                <TableCell>
                  <Badge variant={p.stockSuivi ? "success" : "secondary"}>
                    <span
                      className={
                        p.stockSuivi
                          ? "size-1.5 rounded-full bg-success"
                          : "size-1.5 rounded-full bg-muted-foreground"
                      }
                    />
                    {p.stockSuivi ? "Suivi" : "Non suivi"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/catalog/products/${p.id}/variants`}
                    className="text-sm text-primary underline-offset-4 hover:underline"
                  >
                    {p.activeVariants} variante{p.activeVariants > 1 ? "s" : ""}
                  </Link>
                </TableCell>
                {showLots && (
                  <TableCell>
                    {p.lotsHref ? (
                      <Link
                        href={p.lotsHref}
                        className="text-sm text-primary underline-offset-4 hover:underline"
                      >
                        Voir les lots
                      </Link>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                )}
                {showSerial && (
                  <TableCell>
                    {p.serialHref ? (
                      <Link
                        href={p.serialHref}
                        className="text-sm text-primary underline-offset-4 hover:underline"
                      >
                        Voir les numéros
                      </Link>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                )}
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon-sm" render={<Link href={`/catalog/products/${p.id}/variants`} />}>
                    <Pencil className="size-3.5" />
                    <span className="sr-only">Modifier</span>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {pageRows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7 + (showLots ? 1 : 0) + (showSerial ? 1 : 0)}
                  className="text-center text-muted-foreground"
                >
                  Aucun produit ne correspond à ces critères.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {currentPage} sur {pageCount} — {filtered.length} produit
            {filtered.length > 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              disabled={currentPage <= 1}
              onClick={() => goToPage(currentPage - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            {Array.from({ length: pageCount }, (_, i) => i + 1)
              .filter(
                (n) => n === 1 || n === pageCount || Math.abs(n - currentPage) <= 1,
              )
              .reduce<number[]>((acc, n) => {
                const prev = acc[acc.length - 1];
                if (prev !== undefined && n - prev > 1) acc.push(-1);
                acc.push(n);
                return acc;
              }, [])
              .map((n, i) =>
                n === -1 ? (
                  <span key={`ellipsis-${i}`} className="px-1.5 text-subtle-foreground">
                    …
                  </span>
                ) : (
                  <Button
                    key={n}
                    variant={n === currentPage ? "default" : "ghost"}
                    size="icon-sm"
                    onClick={() => goToPage(n)}
                  >
                    {n}
                  </Button>
                ),
              )}
            <Button
              variant="outline"
              size="icon-sm"
              disabled={currentPage >= pageCount}
              onClick={() => goToPage(currentPage + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
