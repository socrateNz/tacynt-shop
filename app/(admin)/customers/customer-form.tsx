"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createCustomer, type CustomerFormState } from "./actions";

const initialState: CustomerFormState = { error: null };

export function CustomerForm() {
  const [state, formAction, isPending] = useActionState(createCustomer, initialState);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6"
    >
      <h2 className="text-sm font-medium text-foreground">Nouveau client</h2>

      {state.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nom">Nom</Label>
          <Input id="nom" name="nom" required placeholder="Boutique Awa" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="telephone">Téléphone</Label>
          <Input id="telephone" name="telephone" placeholder="+237 6XX XX XX XX" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="categorieTarif">Catégorie tarifaire (optionnel)</Label>
          <Input id="categorieTarif" name="categorieTarif" placeholder="Grossiste" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="plafondCredit">Plafond de crédit (ardoise)</Label>
          <Input
            id="plafondCredit"
            name="plafondCredit"
            type="number"
            step="0.01"
            defaultValue="0"
          />
        </div>
      </div>

      <Button type="submit" className="self-start" disabled={isPending}>
        {isPending ? "Création..." : "Créer le client"}
      </Button>
    </form>
  );
}
