"use client";

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
  codeBarres: string | null;
  priceLabel: string;
  actif: boolean;
};

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
                      {v.actif && (
                        <form action={deactivateVariant}>
                          <input type="hidden" name="variantId" value={v.id} />
                          <Button type="submit" variant="ghost" size="sm">
                            Désactiver
                          </Button>
                        </form>
                      )}
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
