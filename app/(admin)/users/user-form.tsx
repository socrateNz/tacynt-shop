"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createUser, type UserFormState } from "./actions";

const initialState: UserFormState = { error: null };

const ROLE_OPTIONS = [
  { value: "GERANT", label: "Gérant" },
  { value: "RESPONSABLE_STOCK", label: "Responsable stock" },
  { value: "VENDEUR", label: "Vendeur" },
  { value: "COMPTABLE", label: "Comptable" },
];

export function UserForm() {
  const [state, formAction, isPending] = useActionState(createUser, initialState);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6"
    >
      <h2 className="text-sm font-medium text-foreground">Nouvel utilisateur</h2>

      {state.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Mot de passe initial</Label>
          <Input id="password" name="password" type="password" required minLength={8} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="role">Rôle</Label>
          <select
            id="role"
            name="role"
            required
            className="h-8 rounded-md border border-border bg-background px-2.5 text-sm"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Button type="submit" className="self-start" disabled={isPending}>
        {isPending ? "Création..." : "Créer l'utilisateur"}
      </Button>
    </form>
  );
}
