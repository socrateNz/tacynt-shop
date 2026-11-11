"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { fulfillOrder, type FulfillOrderState } from "./fulfill-actions";

const PAYMENT_MODE_LABELS: Record<string, string> = {
  ESPECES: "Espèces",
  MOBILE_MONEY: "Mobile Money",
  CARTE: "Carte",
  VIREMENT: "Virement",
  ARDOISE: "Ardoise",
  BON_ACHAT: "Bon d'achat",
};

const initialState: FulfillOrderState = { error: null };

export function FulfillForm({ orderId, totalTtc }: { orderId: string; totalTtc: number }) {
  const [state, formAction, isPending] = useActionState(fulfillOrder, initialState);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-border bg-muted/40 p-4"
    >
      <h2 className="text-base font-semibold text-foreground">Encaisser la commande</h2>
      <p className="text-sm text-muted-foreground">
        À faire quand le client récupère sa commande : elle devient une vente et le stock est décompté à ce moment-là.
      </p>
      {state.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <input type="hidden" name="orderId" value={orderId} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-40 flex-1 flex-col gap-1.5">
          <Label htmlFor="paymentMode">Mode de paiement</Label>
          <select
            id="paymentMode"
            name="paymentMode"
            className="h-8 rounded-md border border-border bg-background px-2.5 text-sm"
          >
            {Object.entries(PAYMENT_MODE_LABELS).map(([mode, label]) => (
              <option key={mode} value={mode}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="montant">Montant encaissé</Label>
          <Input
            id="montant"
            name="montant"
            type="number"
            step="0.01"
            defaultValue={totalTtc}
            required
          />
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Encaissement..." : "Encaisser"}
        </Button>
      </div>
    </form>
  );
}
