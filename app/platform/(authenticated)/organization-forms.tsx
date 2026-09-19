"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { MODULE_CATALOG } from "@/lib/tenant/modules";

import {
  deleteOrganization,
  recordPlatformPayment,
  updateOrganizationModules,
  updateOrganizationOwnerCredentials,
  updateOrganizationPlanStatus,
  type DeleteOrganizationState,
  type RecordPaymentState,
  type UpdateModulesState,
  type UpdateOwnerCredentialsState,
  type UpdatePlanStatusState,
} from "./organization-detail-actions";

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
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-40 flex-1 flex-col gap-1.5">
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
        <div className="flex min-w-40 flex-1 flex-col gap-1.5">
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

const initialModulesState: UpdateModulesState = { error: null };

export function ModulesForm({
  organizationId,
  enabledModules,
}: {
  organizationId: string;
  enabledModules: string[];
}) {
  const [state, formAction, isPending] = useActionState(
    updateOrganizationModules,
    initialModulesState,
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6"
    >
      <h2 className="text-sm font-medium text-foreground">Modules premium</h2>
      <p className="text-sm text-muted-foreground">
        Activation manuelle après encaissement — aucune bascule en libre-service côté
        organisation.
      </p>
      {state.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <input type="hidden" name="organizationId" value={organizationId} />
      <div className="flex flex-col gap-2">
        {MODULE_CATALOG.map((m) => (
          <label key={m.key} className="flex items-start gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              name="modules"
              value={m.key}
              defaultChecked={enabledModules.includes(m.key)}
              className="mt-0.5 size-4"
            />
            <span>
              <span className="font-medium">{m.label}</span>
              <span className="block text-xs text-muted-foreground">{m.desc}</span>
            </span>
          </label>
        ))}
      </div>
      <Button type="submit" className="self-start" disabled={isPending}>
        {isPending ? "Enregistrement..." : "Enregistrer les modules"}
      </Button>
    </form>
  );
}

const initialOwnerCredentialsState: UpdateOwnerCredentialsState = { error: null };

export function OwnerCredentialsForm({
  organizationId,
  ownerEmail,
}: {
  organizationId: string;
  ownerEmail: string | null;
}) {
  const [state, formAction, isPending] = useActionState(
    updateOrganizationOwnerCredentials,
    initialOwnerCredentialsState,
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6"
    >
      <h2 className="text-sm font-medium text-foreground">Identifiants du propriétaire</h2>
      <p className="text-sm text-muted-foreground">
        Pour aider un client qui a perdu ses identifiants — à transmettre vous-même, aucun email
        n&apos;est envoyé.
      </p>
      {!ownerEmail && (
        <p className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-foreground">
          Aucun compte Propriétaire trouvé pour cette organisation.
        </p>
      )}
      {state.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <input type="hidden" name="organizationId" value={organizationId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ownerEmail">Email</Label>
          <Input
            id="ownerEmail"
            // Force un nouveau montage quand ownerEmail change (mise à jour
            // réussie, revalidatePath) : un champ non contrôlé ne relit
            // jamais defaultValue après son premier rendu — sans ce key,
            // le champ restait affiché avec l'ancien email malgré la
            // sauvegarde réussie (avertissement Base UI constaté en test :
            // "changing the default value state of an uncontrolled
            // FieldControl after being initialized").
            key={ownerEmail ?? "none"}
            name="email"
            type="email"
            required
            defaultValue={ownerEmail ?? ""}
            disabled={!ownerEmail}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ownerPassword">Nouveau mot de passe</Label>
          <Input
            id="ownerPassword"
            name="password"
            type="password"
            minLength={8}
            placeholder="Laisser vide pour ne pas changer"
            disabled={!ownerEmail}
          />
        </div>
      </div>
      <Button type="submit" className="self-start" disabled={isPending || !ownerEmail}>
        {isPending ? "Enregistrement..." : "Mettre à jour les identifiants"}
      </Button>
    </form>
  );
}

const initialDeleteState: DeleteOrganizationState = { error: null };

export function DeleteOrganizationForm({
  organizationId,
  slug,
}: {
  organizationId: string;
  slug: string;
}) {
  const [state, formAction, isPending] = useActionState(deleteOrganization, initialDeleteState);
  const [confirmSlug, setConfirmSlug] = useState("");
  const confirmed = confirmSlug === slug;

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-6"
    >
      <h2 className="text-sm font-medium text-destructive">Zone dangereuse</h2>
      <p className="text-sm text-muted-foreground">
        Supprime définitivement l&apos;organisation et TOUTES ses données (boutiques, ventes,
        clients, produits, historique...). Irréversible, aucune sauvegarde de secours.
      </p>
      {state.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <input type="hidden" name="organizationId" value={organizationId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirmSlug">
          Tapez <span className="num font-semibold text-foreground">{slug}</span> pour confirmer
        </Label>
        <Input
          id="confirmSlug"
          name="confirmSlug"
          value={confirmSlug}
          onChange={(e) => setConfirmSlug(e.target.value)}
          autoComplete="off"
        />
      </div>
      <Button
        type="submit"
        variant="destructive"
        className="self-start"
        disabled={isPending || !confirmed}
      >
        {isPending ? "Suppression..." : "Supprimer définitivement l'organisation"}
      </Button>
    </form>
  );
}
