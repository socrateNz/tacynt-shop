"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { COUNTRIES } from "@/lib/tenant/country";
import { CURRENCIES } from "@/lib/tenant/currency";
import { slugify } from "@/lib/tenant/slugify";

import { createOrganization, type CreateOrganizationState } from "./actions";

const initialState: CreateOrganizationState = { error: null };

export function NewOrganizationForm({ rootDomain }: { rootDomain: string }) {
  const [state, formAction, isPending] = useActionState(createOrganization, initialState);
  const [domaine, setDomaine] = useState("");

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6"
    >
      {state.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nom">Nom de la boutique</Label>
        <Input id="nom" name="nom" required placeholder="Épicerie du Marché" />
        <p className="text-xs text-muted-foreground">Le nom affiché aux clients sur la vitrine.</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="domaine">Domaine de la boutique</Label>
        <Input
          id="domaine"
          name="domaine"
          required
          placeholder="epicerie-marche"
          value={domaine}
          onChange={(e) => setDomaine(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          {/\p{L}|\p{N}/u.test(domaine) ? (
            <>
              Adresse de la boutique :{" "}
              <span className="font-medium text-foreground">
                {slugify(domaine)}.{rootDomain}
              </span>
            </>
          ) : (
            "Sert à construire l'adresse web de la boutique."
          )}
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ownerNom">Nom du propriétaire</Label>
        <Input id="ownerNom" name="ownerNom" required placeholder="Awa Ndiaye" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pays">Pays</Label>
        <select
          id="pays"
          name="pays"
          defaultValue="CM"
          className="h-8 rounded-md border border-border bg-background px-2.5 text-sm"
        >
          {COUNTRIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Cameroun : paiement en ligne par Mobile Money possible. Autres pays : paiement hors ligne
          uniquement (à la réception).
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="devise">Devise</Label>
        <select
          id="devise"
          name="devise"
          defaultValue="XOF"
          className="h-8 rounded-md border border-border bg-background px-2.5 text-sm"
        >
          {CURRENCIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email du propriétaire</Label>
        <Input id="email" name="email" type="email" required placeholder="vous@boutique.com" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Mot de passe initial</Label>
        <PasswordInput id="password" name="password" required minLength={8} />
        <p className="text-xs text-muted-foreground">
          À transmettre vous-même au propriétaire — aucun email n&apos;est envoyé.
        </p>
      </div>

      <Button type="submit" className="self-end" disabled={isPending}>
        {isPending ? "Création..." : "Créer l'organisation"}
      </Button>
    </form>
  );
}
