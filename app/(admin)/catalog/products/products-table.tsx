"use client";

import { useMemo, useState } from "react";
import { Hash, Layers, Package, Pencil, Search } from "lucide-react";

import { EmptyState, TablePanel, Toolbar } from "@/components/admin/page";
import { Pagination, usePagination } from "@/components/admin/pagination";
import { RowActions } from "@/components/admin/row-actions";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { ProductEditDialog, type ProductEditValues } from "./product-edit-dialog";
import { ProductLotsDialog, type ProductLotRow } from "./product-lots-dialog";
import { ProductSerialNumbersDialog, type ProductSerialNumberRow } from "./product-serial-numbers-dialog";
import { ProductVariantsDialog, type ProductVariantRow } from "./product-variants-dialog";

export type ProductRow = {
  id: string;
  reference: string;
  designation: string;
  categoryName: string | null;
  priceLabel: string;
  priceValue: number;
  stockSuivi: boolean;
  activeVariants: number;
  variants: ProductVariantRow[];
  hasLots: boolean;
  lots: ProductLotRow[];
  hasSerialNumbers: boolean;
  serialNumbers: ProductSerialNumberRow[];
  coverImageId: string | null;
  edit: ProductEditValues;
};

type SortKey = "designation" | "price-desc" | "variants-desc";

const SORT_LABELS: Record<SortKey, string> = {
  designation: "Nom (A → Z)",
  "price-desc": "Prix (décroissant)",
  "variants-desc": "Variantes (décroissant)",
};

type Shared = {
  categories: { id: string; nom: string }[];
  canWrite: boolean;
  showLots: boolean;
  showSerial: boolean;
};

export function ProductsTable({ products, ...shared }: Shared & { products: ProductRow[] }) {
  const { categories } = shared;
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("designation");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = products.filter((p) => {
      if (term && !p.designation.toLowerCase().includes(term) && !p.reference.toLowerCase().includes(term)) {
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

  const pagination = usePagination(filtered, 20, [search, categoryFilter, stockFilter, sort]);
  const filteredActive = search.trim() !== "" || categoryFilter !== "all" || stockFilter !== "all";

  return (
    <div className="flex flex-col gap-4">
      <Toolbar>
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-subtle-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nom ou référence…"
            aria-label="Rechercher un produit"
            className="pl-8"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:ml-auto sm:flex">
          <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(String(value))}>
            <SelectTrigger aria-label="Catégorie">
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
          <Select value={stockFilter} onValueChange={(value) => setStockFilter(String(value))}>
            <SelectTrigger aria-label="Suivi du stock">
              <SelectValue placeholder="Stock" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tout le stock</SelectItem>
              <SelectItem value="tracked">Stock suivi</SelectItem>
              <SelectItem value="untracked">Stock non suivi</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
            <SelectTrigger aria-label="Trier par" className="col-span-2">
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
        </div>
      </Toolbar>

      <TablePanel footer={<Pagination {...pagination} unit={["produit", "produits"]} />}>
        {pagination.rows.length === 0 ? (
          filteredActive ? (
            <EmptyState
              icon={Search}
              title="Aucun produit trouvé"
              description="Aucun produit ne correspond à ces critères. Modifiez la recherche ou les filtres."
            />
          ) : (
            <EmptyState
              icon={Package}
              title="Aucun produit"
              description="Ajoutez votre premier produit avec le bouton « Ajouter un produit » en haut de la page."
            />
          )
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produit</TableHead>
                <TableHead className="hidden md:table-cell">Catégorie</TableHead>
                <TableHead className="text-right">Prix de vente</TableHead>
                <TableHead className="hidden sm:table-cell">Stock</TableHead>
                <TableHead className="hidden lg:table-cell">Variantes</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagination.rows.map((p) => (
                <ProductTableRow key={p.id} product={p} {...shared} />
              ))}
            </TableBody>
          </Table>
        )}
      </TablePanel>
    </div>
  );
}

type OpenDialog = null | "edit" | "variants" | "lots" | "serials";

function ProductTableRow({ product: p, categories, canWrite, showLots, showSerial }: Shared & { product: ProductRow }) {
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const openChange = (name: Exclude<OpenDialog, null>) => (open: boolean) => setDialog(open ? name : null);

  return (
    <TableRow>
      <TableCell>
        <div className="flex min-w-0 items-center gap-3">
          {p.coverImageId ? (
            // eslint-disable-next-line @next/next/no-img-element -- image binaire servie par la route, pas un asset statique optimisable
            <img
              src={`/api/products/${p.id}/images/${p.coverImageId}`}
              alt=""
              className="size-10 shrink-0 rounded-md border border-border object-cover"
            />
          ) : (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-subtle-foreground">
              <Package className="size-4" aria-hidden />
            </span>
          )}
          <div className="flex min-w-0 flex-col">
            {canWrite ? (
              <button
                type="button"
                onClick={() => setDialog("edit")}
                className="truncate text-left font-medium text-foreground hover:text-primary hover:underline"
              >
                {p.designation}
              </button>
            ) : (
              <span className="truncate font-medium text-foreground">{p.designation}</span>
            )}
            <span className="num text-xs text-subtle-foreground">{p.reference}</span>
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden text-muted-foreground md:table-cell">{p.categoryName ?? "—"}</TableCell>
      <TableCell className="num text-right">{p.priceLabel}</TableCell>
      <TableCell className="hidden sm:table-cell">
        <Badge variant={p.stockSuivi ? "success" : "secondary"}>{p.stockSuivi ? "Suivi" : "Non suivi"}</Badge>
      </TableCell>
      <TableCell className="hidden text-muted-foreground lg:table-cell">
        {p.activeVariants} variante{p.activeVariants > 1 ? "s" : ""}
      </TableCell>
      <TableCell className="text-right">
        <RowActions
          label={`Actions pour ${p.designation}`}
          actions={[
            { label: "Modifier", icon: Pencil, onSelect: () => setDialog("edit"), hidden: !canWrite },
            { label: "Variantes", icon: Layers, onSelect: () => setDialog("variants") },
            { label: "Lots", icon: Layers, onSelect: () => setDialog("lots"), hidden: !showLots || !p.hasLots },
            {
              label: "Numéros de série",
              icon: Hash,
              onSelect: () => setDialog("serials"),
              hidden: !showSerial || !p.hasSerialNumbers,
            },
          ]}
        />
        {canWrite && (
          <ProductEditDialog
            product={p.edit}
            categories={categories}
            showLots={showLots}
            showSerial={showSerial}
            open={dialog === "edit"}
            onOpenChange={openChange("edit")}
          />
        )}
        <ProductVariantsDialog
          productId={p.id}
          productDesignation={p.designation}
          variants={p.variants}
          canWrite={canWrite}
          triggerLabel=""
          open={dialog === "variants"}
          onOpenChange={openChange("variants")}
        />
        {p.hasLots && (
          <ProductLotsDialog
            productDesignation={p.designation}
            lots={p.lots}
            open={dialog === "lots"}
            onOpenChange={openChange("lots")}
          />
        )}
        {p.hasSerialNumbers && (
          <ProductSerialNumbersDialog
            productDesignation={p.designation}
            serialNumbers={p.serialNumbers}
            open={dialog === "serials"}
            onOpenChange={openChange("serials")}
          />
        )}
      </TableCell>
    </TableRow>
  );
}
