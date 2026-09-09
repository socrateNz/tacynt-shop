"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { shipTransfer, type ShipTransferState } from "./actions";

const initialState: ShipTransferState = { error: null };

type ShipLine = { lineId: string; designation: string; quantiteDemandee: number };

export function ShipForm({ transferId, lines }: { transferId: string; lines: ShipLine[] }) {
  const [state, formAction, isPending] = useActionState(shipTransfer, initialState);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6"
    >
      <h2 className="text-sm font-medium text-foreground">Expédier</h2>
      <input type="hidden" name="transferId" value={transferId} />

      {state.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {lines.map((l) => (
          <div key={l.lineId} className="flex items-end gap-2">
            <input type="hidden" name="lineId" value={l.lineId} />
            <div className="flex-1">
              <p className="text-sm text-foreground">{l.designation}</p>
              <p className="text-xs text-muted-foreground">Demandé : {l.quantiteDemandee}</p>
            </div>
            <div className="flex w-28 flex-col gap-1.5">
              <Label>Qté expédiée</Label>
              <Input
                name="lineQuantiteExpediee"
                type="number"
                step="0.001"
                defaultValue={l.quantiteDemandee}
              />
            </div>
          </div>
        ))}
      </div>

      <Button type="submit" className="self-start" disabled={isPending}>
        {isPending ? "Expédition..." : "Confirmer l'expédition"}
      </Button>
    </form>
  );
}
