"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PAYMENT_MODES = [
  { value: "ESPECES", label: "Espèces" },
  { value: "MOBILE_MONEY", label: "Mobile Money" },
  { value: "CARTE", label: "Carte" },
  { value: "VIREMENT", label: "Virement" },
];

export function ExpenseForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsPending(true);
    try {
      const formData = new FormData(e.currentTarget);
      const res = await fetch("/api/expenses", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Échec de l'enregistrement de la dépense.");
        return;
      }
      e.currentTarget.reset();
      router.refresh();
    } catch {
      setError("Échec de l'enregistrement de la dépense.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6"
    >
      <h2 className="text-sm font-medium text-foreground">Nouvelle dépense</h2>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="categorie">Catégorie</Label>
          <Input id="categorie" name="categorie" required placeholder="Fournitures" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="montant">Montant</Label>
          <Input id="montant" name="montant" type="number" step="0.01" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="modePaiement">Mode de paiement</Label>
          <select
            id="modePaiement"
            name="modePaiement"
            required
            defaultValue="ESPECES"
            className="h-8 rounded-md border border-border bg-background px-2.5 text-sm"
          >
            {PAYMENT_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="justificatif">Justificatif (photo, optionnel)</Label>
          <input id="justificatif" name="justificatif" type="file" accept="image/*,.pdf" className="text-sm" />
        </div>
      </div>

      <Button type="submit" className="self-start" disabled={isPending}>
        {isPending ? "Enregistrement..." : "Enregistrer la dépense"}
      </Button>
    </form>
  );
}
