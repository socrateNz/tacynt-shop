"use client";

import { useActionState, useState } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { deleteShop, type DeleteShopState } from "./actions";

const initialState: DeleteShopState = { error: null };

// Réservé au Propriétaire (shops:delete) — le bouton n'est même rendu par
// l'appelant (page.tsx) que si le rôle a cette capacité, jamais partagée
// avec Gérant. Même patron de confirmation ("tapez le nom exact") que
// DeleteOrganizationForm côté admin plateforme.
export function DeleteShopDialog({ shopId, shopNom }: { shopId: string; shopNom: string }) {
  const [state, formAction, isPending] = useActionState(deleteShop, initialState);
  const [confirmNom, setConfirmNom] = useState("");
  const confirmed = confirmNom === shopNom;

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          />
        }
      >
        <Trash2 className="size-3.5" />
        <span className="sr-only">Supprimer</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Supprimer {shopNom}</DialogTitle>
        </DialogHeader>
        <form
          action={formAction}
          className="flex flex-col gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4"
        >
          <p className="text-sm text-muted-foreground">
            Supprime définitivement cette boutique et toutes ses données propres (ventes, stock,
            sessions de caisse, achats, dépenses, transferts, historique...). Le catalogue, les
            clients et les fournisseurs de l&apos;organisation ne sont pas touchés. Irréversible,
            aucune sauvegarde de secours.
          </p>
          {state.error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          )}
          <input type="hidden" name="shopId" value={shopId} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`confirmNom-${shopId}`}>
              Tapez <span className="font-semibold text-foreground">{shopNom}</span> pour confirmer
            </Label>
            <Input
              id={`confirmNom-${shopId}`}
              name="confirmNom"
              value={confirmNom}
              onChange={(e) => setConfirmNom(e.target.value)}
              autoComplete="off"
            />
          </div>
          <Button
            type="submit"
            variant="destructive"
            className="self-start"
            disabled={isPending || !confirmed}
          >
            {isPending ? "Suppression..." : "Supprimer définitivement la boutique"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
