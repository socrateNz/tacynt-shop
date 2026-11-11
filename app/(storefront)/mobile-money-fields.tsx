"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { guessNetwork, normalizeCameroonPhone } from "@/lib/payments/phone";

export type Operateur = "MTN_CM" | "ORANGE_CM";
export type MobileMoneyValue = { telephone: string; operateur: Operateur | null };

const OPERATEURS: { value: Operateur; label: string }[] = [
  { value: "ORANGE_CM", label: "Orange Money" },
  { value: "MTN_CM", label: "MTN MoMo" },
];

// Opérateur effectif : choix explicite du client, sinon deviné d'après le
// préfixe du numéro.
export function effectiveOperateur(value: MobileMoneyValue): Operateur | null {
  if (value.operateur) return value.operateur;
  const phone = normalizeCameroonPhone(value.telephone);
  return phone ? guessNetwork(phone) : null;
}

export function mobileMoneyReady(value: MobileMoneyValue): boolean {
  return normalizeCameroonPhone(value.telephone) !== null && effectiveOperateur(value) !== null;
}

// Numéro Mobile Money + opérateur pour le paiement direct : la demande de
// paiement arrive sur ce téléphone, le client la valide avec son code PIN
// (jamais saisi sur le site).
export function MobileMoneyFields({
  value,
  onChange,
  idPrefix = "mm",
}: {
  value: MobileMoneyValue;
  onChange: (value: MobileMoneyValue) => void;
  idPrefix?: string;
}) {
  const operateur = effectiveOperateur(value);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-telephone`}>Numéro Mobile Money</Label>
        <Input
          id={`${idPrefix}-telephone`}
          inputMode="tel"
          autoComplete="tel"
          placeholder="6 77 00 00 00"
          value={value.telephone}
          onChange={(e) => onChange({ telephone: e.target.value, operateur: null })}
        />
      </div>
      <div className="flex flex-wrap gap-4" role="radiogroup" aria-label="Opérateur">
        {OPERATEURS.map((o) => (
          <label key={o.value} className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="radio"
              name={`${idPrefix}-operateur`}
              checked={operateur === o.value}
              onChange={() => onChange({ ...value, operateur: o.value })}
            />
            {o.label}
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Une demande de paiement sera envoyée sur ce numéro : validez-la avec votre code PIN Mobile Money.
      </p>
    </div>
  );
}
