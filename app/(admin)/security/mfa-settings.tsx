"use client";

import { useState } from "react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MfaSettings({ initiallyEnabled }: { initiallyEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initiallyEnabled);
  const [enrolling, setEnrolling] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function startEnrollment() {
    setError(null);
    const res = await fetch("/api/auth/mfa/enroll", { method: "POST" });
    if (!res.ok) {
      setError("Impossible de démarrer l'activation.");
      return;
    }
    const data = (await res.json()) as { secret: string; qrDataUrl: string };
    setSecret(data.secret);
    setQrDataUrl(data.qrDataUrl);
    setEnrolling(true);
  }

  async function confirmEnrollment() {
    setError(null);
    const res = await fetch("/api/auth/mfa/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Code invalide.");
      return;
    }
    setEnabled(true);
    setEnrolling(false);
    setQrDataUrl(null);
    setSecret(null);
    setToken("");
  }

  async function disable() {
    setError(null);
    const res = await fetch("/api/auth/mfa/disable", { method: "POST" });
    if (!res.ok) {
      setError("Impossible de désactiver la double authentification.");
      return;
    }
    setEnabled(false);
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
      <h2 className="text-sm font-medium text-foreground">Double authentification (MFA)</h2>
      <p className="text-sm text-muted-foreground">
        Recommandée pour les rôles Propriétaire et Gérant (section 8 du cahier des charges).
      </p>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {enabled ? (
        <div className="flex items-center gap-3">
          <span className="text-sm text-success">Activée</span>
          <Button variant="outline" size="sm" onClick={disable}>
            Désactiver
          </Button>
        </div>
      ) : enrolling && qrDataUrl && secret ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Scannez ce QR code avec votre application d&apos;authentification (Google
            Authenticator, Authy...), ou saisissez la clé manuellement :{" "}
            <code className="text-xs">{secret}</code>
          </p>
          <Image src={qrDataUrl} alt="QR code MFA" width={200} height={200} unoptimized />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mfaToken">Code de confirmation</Label>
            <Input
              id="mfaToken"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              inputMode="numeric"
              maxLength={6}
            />
          </div>
          <Button onClick={confirmEnrollment} className="self-start">
            Confirmer l&apos;activation
          </Button>
        </div>
      ) : (
        <Button variant="outline" className="self-start" onClick={startEnrollment}>
          Activer la double authentification
        </Button>
      )}
    </div>
  );
}
