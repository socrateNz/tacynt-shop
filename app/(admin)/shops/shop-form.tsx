"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createShop, type ShopFormState } from "./actions";

const initialState: ShopFormState = { error: null };

export function ShopForm() {
  const [state, formAction, isPending] = useActionState(createShop, initialState);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6"
    >
      <h2 className="text-sm font-medium text-foreground">Nouvelle boutique</h2>

      {state.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nom">Nom</Label>
          <Input id="nom" name="nom" required placeholder="Boutique Nord" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="telephone">Téléphone</Label>
          <Input id="telephone" name="telephone" placeholder="+237 6XX XX XX XX" />
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="adresse">Adresse</Label>
          <Input id="adresse" name="adresse" />
        </div>
      </div>

      <Button type="submit" className="self-start" disabled={isPending}>
        {isPending ? "Création..." : "Créer la boutique"}
      </Button>
    </form>
  );
}
