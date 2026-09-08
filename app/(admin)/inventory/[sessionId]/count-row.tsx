"use client";

import { Fragment, useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";

import { recordInventoryCount, type InventoryCountState } from "./actions";

const initialState: InventoryCountState = { error: null };

export function CountRow({
  inventorySessionId,
  variantId,
  designation,
  quantiteTheoriqueActuelle,
  existingCount,
  readOnly,
}: {
  inventorySessionId: string;
  variantId: string;
  designation: string;
  quantiteTheoriqueActuelle: number;
  existingCount: { quantiteTheorique: number; quantiteComptee: number | null } | null;
  readOnly: boolean;
}) {
  const [state, formAction, isPending] = useActionState(recordInventoryCount, initialState);

  const ecart =
    existingCount?.quantiteComptee !== null && existingCount?.quantiteComptee !== undefined
      ? existingCount.quantiteComptee - existingCount.quantiteTheorique
      : null;

  return (
    <Fragment>
      <TableRow>
        <TableCell className="text-foreground">{designation}</TableCell>
        <TableCell className="num text-right text-muted-foreground">
          {existingCount ? existingCount.quantiteTheorique : quantiteTheoriqueActuelle}
        </TableCell>
        <TableCell className="text-right">
          {readOnly ? (
            <span className="num">{existingCount?.quantiteComptee ?? "—"}</span>
          ) : (
            <form action={formAction} className="flex items-center justify-end gap-2">
              <input type="hidden" name="inventorySessionId" value={inventorySessionId} />
              <input type="hidden" name="variantId" value={variantId} />
              <Input
                name="quantiteComptee"
                type="number"
                step="0.001"
                defaultValue={existingCount?.quantiteComptee ?? ""}
                className="w-24"
              />
              <Button type="submit" size="sm" variant="outline" disabled={isPending}>
                {isPending ? "..." : existingCount ? "Corriger" : "Compter"}
              </Button>
            </form>
          )}
        </TableCell>
        <TableCell
          className={`num text-right ${ecart !== null && ecart !== 0 ? "text-destructive" : "text-muted-foreground"}`}
        >
          {ecart !== null ? ecart : "—"}
        </TableCell>
      </TableRow>
      {state.error && (
        <TableRow>
          <TableCell colSpan={4} className="text-sm text-destructive">
            {state.error}
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  );
}
