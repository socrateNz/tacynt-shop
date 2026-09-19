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
    // Capturé avant le premier await : event.currentTarget redevient null
    // dès que la pile d'appels synchrone se termine (spec DOM, pas propre à
    // React) — l'appeler après un await plantait silencieusement .reset(),
    // rattrapé par le catch ci-dessous qui affichait alors un échec même
    // quand l'enregistrement avait réussi côté serveur (bug réel constaté).
    const form = e.currentTarget;
    setError(null);
    setIsPending(true);
    try {
      const formData = new FormData(form);
      const res = await fetch("/api/expenses", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Échec de l'enregistrement de la dépense.");
        return;
      }
      form.reset();
      router.refresh();
    } catch {
      setError("Échec de l'enregistrement de la dépense.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
