"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  recordPlatformPayment,
  updateOrganizationPlanStatus,
  type RecordPaymentState,
  type UpdatePlanStatusState,
} from "./actions";

const PLAN_OPTIONS = ["STARTER", "BUSINESS", "PRO", "ENTERPRISE"] as const;
const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Actif" },
  { value: "GRACE_PERIOD", label: "Période de grâce" },
  { value: "SUSPENDED", label: "Suspendu" },
] as const;

const initialPlanState: UpdatePlanStatusState = { error: null };

export function PlanStatusForm({
  organizationId,
  plan,
  statut,
}: {
  organizationId: string;
  plan: string;
  statut: string;
}) {
  const [state, formAction, isPending] = useActionState(
    updateOrganizationPlanStatus,
    initialPlanState,
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6"
    >
      <h2 className="text-sm font-medium text-foreground">Plan et statut</h2>
      {state.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <input type="hidden" name="organizationId" value={organizationId} />
      <div className="flex items-end gap-3">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="plan">Plan</Label>
          <select
            id="plan"
            name="plan"
            defaultValue={plan}
            className="h-8 rounded-md border border-border bg-background px-2.5 text-sm"
          >
            {PLAN_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="statut">Statut</Label>
          <select
            id="statut"
            name="statut"
            defaultValue={statut}
            className="h-8 rounded-md border border-border bg-background px-2.5 text-sm"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Suspendu : les actions d&apos;administration de l&apos;organisation sont bloquées, la
        caisse (vente, encaissement) reste utilisable.
      </p>
    </form>
  );
}

const initialPaymentState: RecordPaymentState = { error: null };

export function RecordPaymentForm({
  organizationId,
  devise,
}: {
  organizationId: string;
  devise: string;
}) {
  const [state, formAction, isPending] = useActionState(
    recordPlatformPayment,
    initialPaymentState,
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6"
    >
      <h2 className="text-sm font-medium text-foreground">Constater un paiement</h2>
      <p className="text-sm text-muted-foreground">
        Aucun prélèvement réel — un enregistrement manuel de ce qui a été perçu hors ligne.
      </p>
      {state.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <input type="hidden" name="organizationId" value={organizationId} />
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="montant">Montant</Label>
          <Input id="montant" name="montant" type="number" step="0.01" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="devise">Devise</Label>
          <Input id="devise" name="devise" defaultValue={devise} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="periodeDebut">Début de période</Label>
          <Input id="periodeDebut" name="periodeDebut" type="date" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="periodeFin">Fin de période</Label>
          <Input id="periodeFin" name="periodeFin" type="date" required />
        </div>
      </div>
      <Button type="submit" className="self-start" disabled={isPending}>
        {isPending ? "Enregistrement..." : "Enregistrer le paiement"}
      </Button>
    </form>
  );
}
