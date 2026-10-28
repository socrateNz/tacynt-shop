"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CURRENCIES } from "@/lib/tenant/currency";
import { PROFILES } from "@/lib/tenant/profile";

import {
  updateDevise,
  updateOnlineOrderEmailAlert,
  updateProfilMetier,
  type SettingsFormState,
} from "./actions";

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
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex min-w-40 flex-1 flex-col gap-1.5">
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

const initialDeviseState: SettingsFormState = { error: null };

export function DeviseForm({ devise }: { devise: string }) {
  const [state, formAction, isPending] = useActionState(updateDevise, initialDeviseState);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6"
    >
      <h2 className="text-sm font-medium text-foreground">Devise</h2>
      <p className="text-sm text-muted-foreground">
        Utilisée pour tous les prix affichés (catalogue, panier, caisse, rapports).
      </p>
      {state.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex min-w-40 flex-1 flex-col gap-1.5">
          <Label htmlFor="devise">Devise</Label>
          <select
            id="devise"
            name="devise"
            defaultValue={devise}
            className="h-8 rounded-md border border-border bg-background px-2.5 text-sm"
          >
            {CURRENCIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
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

const initialOnlineOrderEmailAlertState: SettingsFormState = { error: null };

export function OnlineOrderEmailAlertForm({
  enabled: initialEnabled,
  email: initialEmail,
}: {
  enabled: boolean;
  email: string | null;
}) {
  const [state, formAction, isPending] = useActionState(
    updateOnlineOrderEmailAlert,
    initialOnlineOrderEmailAlertState,
  );
  // Contrôlé localement pour afficher/masquer le champ email tout de suite
  // au clic, sans attendre un aller-retour serveur — la vraie valeur
  // enregistrée reste celle soumise dans le FormData au submit.
  const [enabled, setEnabled] = useState(initialEnabled);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6"
    >
      <h2 className="text-sm font-medium text-foreground">Alerte email — commandes en ligne</h2>
      <p className="text-sm text-muted-foreground">
        Reçoit un email à chaque nouvelle commande passée sur la vitrine, en plus des notifications
        affichées dans l&apos;admin.
      </p>
      {state.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          name="onlineOrderEmailAlertEnabled"
          defaultChecked={initialEnabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="size-4"
        />
        Recevoir un email lors des commandes en ligne
      </label>
      {enabled && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="onlineOrderEmailAlertEmail">Adresse email</Label>
          <Input
            id="onlineOrderEmailAlertEmail"
            name="onlineOrderEmailAlertEmail"
            type="email"
            required
            defaultValue={initialEmail ?? ""}
            placeholder="commandes@votre-boutique.com"
            className="max-w-sm"
          />
        </div>
      )}
      <Button type="submit" className="self-start" disabled={isPending}>
        {isPending ? "Enregistrement..." : "Enregistrer"}
      </Button>
    </form>
  );
}
