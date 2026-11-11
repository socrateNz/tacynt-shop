"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { cancelSale, type CancelSaleState } from "./actions";

const initialState: CancelSaleState = { error: null };

export function CancelSaleForm({ saleId }: { saleId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(cancelSale, initialState);

  if (!open) {
    return (
      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setOpen(true)}>
        Annuler le ticket
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="saleId" value={saleId} />
      <Input name="motif" required placeholder="Motif de l'annulation" aria-label="Motif de l'annulation" className="h-7 w-44 text-xs" />
      <Button type="submit" variant="destructive" size="xs" disabled={isPending}>
        {isPending ? "Annulation…" : "Confirmer l'annulation"}
      </Button>
      {state.error && <span className="text-xs text-destructive">{state.error}</span>}
    </form>
  );
}
