"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PROFILES } from "@/lib/tenant/profile";

import { updateProfilMetier, type SettingsFormState } from "./actions";

const initialState: SettingsFormState = { error: null };

export function ProfilMetierForm({ profilMetier }: { profilMetier: string }) {
  const [state, formAction, isPending] = useActionState(updateProfilMetier, initialState);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6"
    >
      <h2 className="text-sm font-medium text-foreground">Profil métier</h2>
      <p className="text-sm text-muted-foreground">
        Active les spécificités de votre secteur (lots et péremption, numéros de série...).
        Modifiable à tout moment.
      </p>
      {state.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <div className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="profilMetier">Profil</Label>
          <select
            id="profilMetier"
            name="profilMetier"
            defaultValue={profilMetier}
            className="h-8 rounded-md border border-border bg-background px-2.5 text-sm"
          >
            {PROFILES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
