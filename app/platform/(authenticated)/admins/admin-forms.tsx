"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createPlatformAdmin, type CreatePlatformAdminState } from "./actions";

const initialState: CreatePlatformAdminState = { error: null };

export function NewAdminForm() {
  const [state, formAction, isPending] = useActionState(createPlatformAdmin, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required placeholder="collegue@tacynt.com" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Mot de passe initial</Label>
        <Input id="password" name="password" type="password" required minLength={8} />
        <p className="text-xs text-muted-foreground">
          À transmettre vous-même à la personne concernée — aucun email n&apos;est envoyé.
        </p>
      </div>

      <Button type="submit" className="self-start" disabled={isPending}>
        {isPending ? "Création..." : "Créer le compte"}
      </Button>
    </form>
  );
}
