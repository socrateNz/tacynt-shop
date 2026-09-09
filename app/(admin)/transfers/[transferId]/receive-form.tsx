"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { receiveTransfer, type ReceiveTransferState } from "./actions";

const initialState: ReceiveTransferState = { error: null };

type ReceiveLine = { lineId: string; designation: string; quantiteExpediee: number };

export function ReceiveForm({
  transferId,
  lines,
}: {
  transferId: string;
  lines: ReceiveLine[];
}) {
  const [state, formAction, isPending] = useActionState(receiveTransfer, initialState);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6"
    >
      <h2 className="text-sm font-medium text-foreground">Recevoir</h2>
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
              <p className="text-xs text-muted-foreground">Expédié : {l.quantiteExpediee}</p>
            </div>
            <div className="flex w-28 flex-col gap-1.5">
              <Label>Qté reçue</Label>
              <Input
                name="lineQuantiteRecue"
                type="number"
                step="0.001"
                defaultValue={l.quantiteExpediee}
              />
            </div>
          </div>
        ))}
      </div>

      <Button type="submit" className="self-start" disabled={isPending}>
        {isPending ? "Réception..." : "Confirmer la réception"}
      </Button>
    </form>
  );
}
