"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import { startInventorySession, type InventorySessionFormState } from "./actions";

const initialState: InventorySessionFormState = { error: null };

export function InventorySessionForm({
  categories,
}: {
  categories: { id: string; nom: string }[];
}) {
  const [state, formAction, isPending] = useActionState(startInventorySession, initialState);
  const [type, setType] = useState<"COMPLET" | "PARTIEL">("COMPLET");

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6"
    >
      <h2 className="text-sm font-medium text-foreground">Nouvel inventaire</h2>

      {state.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="type">Type</Label>
        <select
          id="type"
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value as "COMPLET" | "PARTIEL")}
          className="h-8 rounded-md border border-border bg-background px-2.5 text-sm"
        >
          <option value="COMPLET">Complet (tout le catalogue suivi en stock)</option>
          <option value="PARTIEL">Partiel (une catégorie)</option>
        </select>
      </div>

      {type === "PARTIEL" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="categoryId">Catégorie</Label>
          <select
            id="categoryId"
            name="categoryId"
            required
            className="h-8 rounded-md border border-border bg-background px-2.5 text-sm"
          >
            <option value="">Sélectionner...</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </select>
        </div>
      )}

      <Button type="submit" className="self-start" disabled={isPending}>
        {isPending ? "Démarrage..." : "Démarrer l'inventaire"}
      </Button>
    </form>
  );
}
