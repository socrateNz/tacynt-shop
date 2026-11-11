"use client";

import { useActionState, useState } from "react";

import { TablePanel } from "@/components/admin/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

import { recountLaundryOrder, type RecountState } from "../../actions";

export type RecountLine = {
  id: string;
  designation: string;
  prixUnitaire: number;
  quantiteDeclaree: number;
  quantiteRecomptee: number | null;
};

const initialState: RecountState = { error: null };

// Lignes de la commande. En mode recomptage, une colonne "Reçues" éditable
// et le calcul en direct de la différence à régulariser au retour.
export function RecountForm({
  orderId,
  lines,
  montantDeclare,
  devise,
  editable,
}: {
  orderId: string;
  lines: RecountLine[];
  montantDeclare: number;
  devise: string;
  editable: boolean;
}) {
  const [state, formAction, isPending] = useActionState(recountLaundryOrder, initialState);
  const [quantites, setQuantites] = useState<Record<string, string>>(() =>
    Object.fromEntries(lines.map((l) => [l.id, String(l.quantiteRecomptee ?? l.quantiteDeclaree)])),
  );

  const montantRecompte = lines.reduce((sum, l) => sum + l.prixUnitaire * (Number(quantites[l.id]) || 0), 0);
  const diff = montantRecompte - montantDeclare;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="orderId" value={orderId} />
      <TablePanel>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Article</TableHead>
              <TableHead className="text-right">Prix / pièce</TableHead>
              <TableHead className="text-right">Déclarées</TableHead>
              <TableHead className="text-right">Reçues</TableHead>
              <TableHead className="text-right">Montant</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((l) => {
              const recue = editable ? Number(quantites[l.id]) || 0 : (l.quantiteRecomptee ?? null);
              const ecart = recue !== null && recue !== l.quantiteDeclaree;
              return (
                <TableRow key={l.id}>
                  <TableCell className="text-foreground">{l.designation}</TableCell>
                  <TableCell className="num text-right">{formatMoney(l.prixUnitaire, devise)}</TableCell>
                  <TableCell className="num text-right">{l.quantiteDeclaree}</TableCell>
                  <TableCell className="text-right">
                    {editable ? (
                      <Input
                        name={`qty_${l.id}`}
                        type="number"
                        min={0}
                        max={1000}
                        step={1}
                        value={quantites[l.id] ?? ""}
                        onChange={(e) => setQuantites((q) => ({ ...q, [l.id]: e.target.value }))}
                        aria-label={`Pièces reçues — ${l.designation}`}
                        className={cn("ml-auto h-8 w-20 text-right", ecart && "border-warning text-warning")}
                      />
                    ) : (
                      <span className={cn("num", ecart && "font-semibold text-warning")}>{recue ?? "—"}</span>
                    )}
                  </TableCell>
                  <TableCell className="num text-right">
                    {formatMoney(l.prixUnitaire * (recue ?? l.quantiteDeclaree), devise)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TablePanel>

      {editable && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-foreground">
            Recompté : <span className="num font-semibold">{formatMoney(montantRecompte, devise)}</span>
            {" — "}
            {diff === 0 ? (
              <span className="text-success">conforme à la déclaration</span>
            ) : diff > 0 ? (
              <span className="font-semibold text-warning">le client devra {formatMoney(diff, devise)} au retour</span>
            ) : (
              <span className="font-semibold text-primary">
                {formatMoney(-diff, devise)} à rendre au client au retour
              </span>
            )}
          </p>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Enregistrement..." : "Enregistrer le recomptage"}
          </Button>
        </div>
      )}
      {state.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.saved && !state.error && (
        <p className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          Recomptage enregistré.
        </p>
      )}
    </form>
  );
}
