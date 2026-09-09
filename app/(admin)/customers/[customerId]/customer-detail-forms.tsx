"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  convertLoyaltyPoints,
  recordPayment,
  updateCustomer,
  type CustomerUpdateState,
  type LoyaltyConversionState,
  type PaymentFormState,
} from "./actions";

const paymentInitialState: PaymentFormState = { error: null };
const updateInitialState: CustomerUpdateState = { error: null };
const loyaltyInitialState: LoyaltyConversionState = { error: null };

export function PaymentForm({ customerId }: { customerId: string }) {
  const [state, formAction, isPending] = useActionState(recordPayment, paymentInitialState);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6"
    >
      <h2 className="text-sm font-medium text-foreground">Enregistrer un paiement</h2>
      {state.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <input type="hidden" name="customerId" value={customerId} />
      <div className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="montant">Montant reçu</Label>
          <Input id="montant" name="montant" type="number" step="0.01" required />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="motif">Motif (optionnel)</Label>
          <Input id="motif" name="motif" placeholder="Paiement espèces" />
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}

export function LoyaltyConversionForm({
  customerId,
  pointsBalance,
}: {
  customerId: string;
  pointsBalance: number;
}) {
  const [state, formAction, isPending] = useActionState(convertLoyaltyPoints, loyaltyInitialState);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6"
    >
      <h2 className="text-sm font-medium text-foreground">Convertir des points en crédit</h2>
      <p className="text-sm text-muted-foreground">Solde de points : {pointsBalance}</p>
      {state.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <input type="hidden" name="customerId" value={customerId} />
      <div className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="points">Points à convertir</Label>
          <Input id="points" name="points" type="number" step="1" max={pointsBalance} required />
        </div>
        <Button type="submit" disabled={isPending || pointsBalance <= 0}>
          {isPending ? "Conversion..." : "Convertir"}
        </Button>
      </div>
    </form>
  );
}

export function CustomerSettingsForm({
  customerId,
  categorieTarif,
  plafondCredit,
  actif,
}: {
  customerId: string;
  categorieTarif: string;
  plafondCredit: number;
  actif: boolean;
}) {
  const [state, formAction, isPending] = useActionState(updateCustomer, updateInitialState);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6"
    >
      <h2 className="text-sm font-medium text-foreground">Paramètres</h2>
      {state.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <input type="hidden" name="customerId" value={customerId} />
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="categorieTarif">Catégorie tarifaire</Label>
          <Input id="categorieTarif" name="categorieTarif" defaultValue={categorieTarif} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="plafondCredit">Plafond de crédit</Label>
          <Input
            id="plafondCredit"
            name="plafondCredit"
            type="number"
            step="0.01"
            defaultValue={plafondCredit}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input type="checkbox" name="actif" defaultChecked={actif} className="size-4" />
        Client actif
      </label>
      <Button type="submit" className="self-start" disabled={isPending}>
        {isPending ? "Enregistrement..." : "Mettre à jour"}
      </Button>
    </form>
  );
}
