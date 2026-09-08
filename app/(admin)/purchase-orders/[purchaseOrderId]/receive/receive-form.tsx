"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { receiveGoods, type ReceiveGoodsState } from "./actions";

const initialState: ReceiveGoodsState = { error: null };

type ReceiveLine = {
  variantId: string;
  designation: string;
  quantiteCommandee: number;
  dejaRecue: number;
  prixUnitaireCommande: number;
};

export function ReceiveForm({
  purchaseOrderId,
  lines,
}: {
  purchaseOrderId: string;
  lines: ReceiveLine[];
}) {
  const [state, formAction, isPending] = useActionState(receiveGoods, initialState);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6"
    >
      <input type="hidden" name="purchaseOrderId" value={purchaseOrderId} />

      {state.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {lines.map((l) => {
          const restant = Math.max(0, l.quantiteCommandee - l.dejaRecue);
          return (
            <div key={l.variantId} className="flex items-end gap-2">
              <input type="hidden" name="lineVariantId" value={l.variantId} />
              <div className="flex-1">
                <p className="text-sm text-foreground">{l.designation}</p>
                <p className="text-xs text-muted-foreground">
                  Commandé {l.quantiteCommandee} · Déjà reçu {l.dejaRecue} · Restant {restant}
                </p>
              </div>
              <div className="flex w-28 flex-col gap-1.5">
                <Label>Qté reçue</Label>
                <Input
                  name="lineQuantiteRecue"
                  type="number"
                  step="0.001"
                  defaultValue={restant > 0 ? restant : 0}
                />
              </div>
              <div className="flex w-28 flex-col gap-1.5">
                <Label>Prix unitaire</Label>
                <Input
                  name="linePrixUnitaireRecu"
                  type="number"
                  step="0.01"
                  defaultValue={l.prixUnitaireCommande}
                />
              </div>
            </div>
          );
        })}
      </div>

      <Button type="submit" className="self-start" disabled={isPending}>
        {isPending ? "Enregistrement..." : "Enregistrer la réception"}
      </Button>
    </form>
  );
}
