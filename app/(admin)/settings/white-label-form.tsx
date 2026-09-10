"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  setCustomDomain,
  setPrimaryColor,
  verifyCustomDomain,
  type SetCustomDomainState,
  type SetPrimaryColorState,
  type VerifyCustomDomainState,
} from "./white-label-actions";

const initialDomainState: SetCustomDomainState = { error: null };
const initialVerifyState: VerifyCustomDomainState = { error: null };
const initialColorState: SetPrimaryColorState = { error: null };

export function WhiteLabelForm({
  customDomain,
  customDomainVerified,
  primaryColor,
  hasLogo,
}: {
  customDomain: string | null;
  customDomainVerified: boolean;
  primaryColor: string | null;
  hasLogo: boolean;
}) {
  const router = useRouter();
  const [domainState, domainAction, domainPending] = useActionState(
    setCustomDomain,
    initialDomainState,
  );
  const [verifyState, verifyAction, verifyPending] = useActionState(
    verifyCustomDomain,
    initialVerifyState,
  );
  const [colorState, colorAction, colorPending] = useActionState(
    setPrimaryColor,
    initialColorState,
  );
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoPending, setLogoPending] = useState(false);

  async function handleLogoSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLogoError(null);
    const formData = new FormData(e.currentTarget);
    setLogoPending(true);
    try {
      const res = await fetch("/api/branding/logo", { method: "POST", body: formData });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setLogoError(body.error ?? "Échec de l'envoi.");
        return;
      }
      router.refresh();
    } finally {
      setLogoPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
      <h2 className="text-sm font-medium text-foreground">White label</h2>
      <p className="text-sm text-muted-foreground">
        Réservé au plan ENTERPRISE — domaine personnalisé, logo et couleur d&apos;accent.
      </p>

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <h3 className="text-sm font-medium text-foreground">Domaine personnalisé</h3>
        {customDomain && (
          <p className="text-sm text-muted-foreground">
            Domaine actuel : <span className="text-foreground">{customDomain}</span> —{" "}
            <span className={customDomainVerified ? "text-primary" : "text-destructive"}>
              {customDomainVerified ? "vérifié" : "non vérifié"}
            </span>
          </p>
        )}
        {domainState.error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {domainState.error}
          </p>
        )}
        <form action={domainAction} className="flex items-end gap-2">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="customDomain">Domaine</Label>
            <Input
              id="customDomain"
              name="customDomain"
              placeholder="boutique.client.com"
              defaultValue={customDomain ?? ""}
            />
          </div>
          <Button type="submit" disabled={domainPending}>
            {domainPending ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </form>

        {customDomain && !customDomainVerified && (
          <>
            <p className="text-xs text-muted-foreground">
              Ajoutez cet enregistrement TXT chez votre fournisseur DNS, puis vérifiez :{" "}
              <code className="rounded bg-muted px-1 py-0.5">
                _tacynt-verify.{customDomain}
              </code>
            </p>
            {verifyState.error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {verifyState.error}
              </p>
            )}
            {verifyState.verified && (
              <p className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
                Domaine vérifié.
              </p>
            )}
            <form action={verifyAction}>
              <Button type="submit" variant="outline" disabled={verifyPending}>
                {verifyPending ? "Vérification..." : "Vérifier le domaine"}
              </Button>
            </form>
          </>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <h3 className="text-sm font-medium text-foreground">Couleur d&apos;accent</h3>
        {colorState.error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {colorState.error}
          </p>
        )}
        <form action={colorAction} className="flex items-end gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="primaryColor">Couleur</Label>
            <Input
              id="primaryColor"
              name="primaryColor"
              type="color"
              defaultValue={primaryColor ?? "#b8431a"}
              className="h-8 w-16 p-1"
            />
          </div>
          <Button type="submit" disabled={colorPending}>
            {colorPending ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </form>
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <h3 className="text-sm font-medium text-foreground">Logo</h3>
        <p className="text-sm text-muted-foreground">
          {hasLogo ? "Un logo est déjà en place." : "Aucun logo pour l'instant."}
        </p>
        {logoError && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {logoError}
          </p>
        )}
        <form onSubmit={handleLogoSubmit} className="flex items-end gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="logo">Fichier (2 Mo max)</Label>
            <input
              id="logo"
              name="logo"
              type="file"
              accept="image/*"
              required
              className="text-sm"
            />
          </div>
          <Button type="submit" disabled={logoPending}>
            {logoPending ? "Envoi..." : "Envoyer"}
          </Button>
        </form>
      </div>
    </div>
  );
}
