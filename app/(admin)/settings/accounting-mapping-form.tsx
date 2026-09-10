"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AccountingMapping } from "@/lib/reports/accounting-mapping";

import { updateAccountingMapping, type UpdateAccountingMappingState } from "./actions";

const PAYMENT_MODE_LABELS: Record<string, string> = {
  ESPECES: "Espèces",
  MOBILE_MONEY: "Mobile Money",
  CARTE: "Carte",
  VIREMENT: "Virement",
  ARDOISE: "Ardoise",
  BON_ACHAT: "Bon d'achat",
};

const initialState: UpdateAccountingMappingState = { error: null };

export function AccountingMappingForm({ mapping }: { mapping: AccountingMapping }) {
  const [state, formAction, isPending] = useActionState(updateAccountingMapping, initialState);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6"
    >
      <h2 className="text-sm font-medium text-foreground">Plan comptable</h2>
      <p className="text-sm text-muted-foreground">
        Mapping par défaut inspiré du SYSCOHADA — un point de départ éditable, pas une garantie
        de conformité comptable certifiée.
      </p>
      {state.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ventesCompte">Compte de ventes</Label>
          <Input id="ventesCompte" name="ventesCompte" defaultValue={mapping.ventesCompte} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tvaCompte">Compte de TVA</Label>
          <Input id="tvaCompte" name="tvaCompte" defaultValue={mapping.tvaCompte} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="chargesCompteParDefaut">Compte de charges par défaut</Label>
          <Input
            id="chargesCompteParDefaut"
            name="chargesCompteParDefaut"
            defaultValue={mapping.chargesCompteParDefaut}
            required
          />
        </div>
      </div>
      <p className="mt-2 text-xs font-medium text-muted-foreground uppercase">
        Comptes par mode de paiement
      </p>
      <div className="grid grid-cols-3 gap-3">
        {Object.entries(mapping.paiementComptes).map(([mode, compte]) => (
          <div key={mode} className="flex flex-col gap-1.5">
            <Label htmlFor={`paiement_${mode}`}>{PAYMENT_MODE_LABELS[mode] ?? mode}</Label>
            <Input id={`paiement_${mode}`} name={`paiement_${mode}`} defaultValue={compte} />
          </div>
        ))}
      </div>
      <Button type="submit" className="mt-2 self-start" disabled={isPending}>
        {isPending ? "Enregistrement..." : "Enregistrer"}
      </Button>
    </form>
  );
}
