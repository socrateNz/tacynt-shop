"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createSupplier, type SupplierFormState } from "./actions";

const initialState: SupplierFormState = { error: null };

export function SupplierForm() {
  const [state, formAction, isPending] = useActionState(createSupplier, initialState);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6"
    >
      <h2 className="text-sm font-medium text-foreground">Nouveau fournisseur</h2>

      {state.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nom">Nom</Label>
          <Input id="nom" name="nom" required placeholder="Grossiste Nord" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="telephone">Téléphone</Label>
          <Input id="telephone" name="telephone" placeholder="+237 6XX XX XX XX" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="delaiLivraisonJours">Délai de livraison (jours)</Label>
          <Input id="delaiLivraisonJours" name="delaiLivraisonJours" type="number" />
        </div>
      </div>

      <Button type="submit" className="self-start" disabled={isPending}>
        {isPending ? "Création..." : "Créer le fournisseur"}
      </Button>
    </form>
  );
}
