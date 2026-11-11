"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { ProductForm } from "./product-form";

// Action principale de la page Produits, dans l'en-tête (à droite du titre).
export function NewProductButton({
  categories,
  showLots,
  showSerial,
}: {
  categories: { id: string; nom: string }[];
  showLots: boolean;
  showSerial: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>
        <Plus />
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
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
