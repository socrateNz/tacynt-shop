"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createOrganization, type CreateOrganizationState } from "./actions";

const initialState: CreateOrganizationState = { error: null };

export function NewOrganizationForm() {
  const [state, formAction, isPending] = useActionState(createOrganization, initialState);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6"
    >
      {state.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nom">Nom de la boutique</Label>
        <Input id="nom" name="nom" required placeholder="Épicerie du Marché" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email du propriétaire</Label>
        <Input id="email" name="email" type="email" required placeholder="vous@boutique.com" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Mot de passe initial</Label>
        <Input id="password" name="password" type="password" required minLength={8} />
        <p className="text-xs text-muted-foreground">
          À transmettre vous-même au propriétaire — aucun email n&apos;est envoyé.
        </p>
      </div>

      <Button type="submit" className="self-start" disabled={isPending}>
        {isPending ? "Création..." : "Créer l'organisation"}
      </Button>
    </form>
  );
}
