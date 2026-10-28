"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
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

import { deactivateVariant } from "./variant-actions";
import { VariantForm } from "./variant-form";

export type ProductVariantRow = {
  id: string;
  attrLabel: string;
  attributs: { name: string; value: string }[];
  codeBarres: string | null;
  priceLabel: string;
  prixAchatRef: number;
  unite: string;
  uniteQuantite: number;
  prixVente: number;
  prixPlancher: number | null;
  seuilAlerte: number | null;
  actif: boolean;
};

function VariantEditTrigger({ variant }: { variant: ProductVariantRow }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <Pencil className="size-3.5" />
        <span className="sr-only">Modifier la variante</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Modifier la variante</DialogTitle>
        </DialogHeader>
        <VariantForm
          variant={{
            id: variant.id,
            attributs: variant.attributs,
            codeBarres: variant.codeBarres,
            prixAchatRef: variant.prixAchatRef,
            unite: variant.unite,
            uniteQuantite: variant.uniteQuantite,
            prixVente: variant.prixVente,
            prixPlancher: variant.prixPlancher,
            seuilAlerte: variant.seuilAlerte,
          }}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

export function ProductVariantsDialog({
  productId,
  productDesignation,
  variants,
  canWrite,
  triggerLabel,
}: {
  productId: string;
  productDesignation: string;
  variants: ProductVariantRow[];
  canWrite: boolean;
  triggerLabel: string;
}) {
  return (
    <Dialog>
      <DialogTrigger
        render={<button type="button" className="text-sm text-primary underline-offset-4 hover:underline" />}
      >
        {triggerLabel}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Variantes — {productDesignation}</DialogTitle>
        </DialogHeader>

        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Attributs</TableHead>
                <TableHead>Code-barres</TableHead>
                <TableHead className="text-right">Prix de vente</TableHead>
                <TableHead>Statut</TableHead>
                {canWrite && <TableHead>Action</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {variants.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="text-foreground">{v.attrLabel}</TableCell>
                  <TableCell className="num text-muted-foreground">{v.codeBarres ?? "—"}</TableCell>
                  <TableCell className="num text-right">{v.priceLabel}</TableCell>
                  <TableCell>
                    <Badge variant={v.actif ? "success" : "secondary"}>
                      {v.actif ? "Active" : "Désactivée"}
                    </Badge>
                  </TableCell>
                  {canWrite && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <VariantEditTrigger variant={v} />
                        {v.actif && (
                          <form action={deactivateVariant}>
                            <input type="hidden" name="variantId" value={v.id} />
                            <Button type="submit" variant="ghost" size="sm">
                              Désactiver
                            </Button>
                          </form>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {canWrite && <VariantForm productId={productId} />}
      </DialogContent>
    </Dialog>
  );
}
