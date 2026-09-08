"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  addSupplierProduct,
  recordSupplierPayment,
  updateSupplier,
  type SupplierPaymentState,
  type SupplierProductState,
  type SupplierUpdateState,
} from "./actions";

const paymentInitialState: SupplierPaymentState = { error: null };
const updateInitialState: SupplierUpdateState = { error: null };
const productInitialState: SupplierProductState = { error: null };

export function SupplierPaymentForm({ supplierId }: { supplierId: string }) {
  const [state, formAction, isPending] = useActionState(recordSupplierPayment, paymentInitialState);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6"
    >
      <h2 className="text-sm font-medium text-foreground">Enregistrer un paiement</h2>
      {state.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <input type="hidden" name="supplierId" value={supplierId} />
      <div className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="montant">Montant payé</Label>
          <Input id="montant" name="montant" type="number" step="0.01" required />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="motif">Motif (optionnel)</Label>
          <Input id="motif" name="motif" placeholder="Virement" />
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}

export function SupplierSettingsForm({
  supplierId,
  delaiLivraisonJours,
  actif,
}: {
  supplierId: string;
  delaiLivraisonJours: number | null;
  actif: boolean;
}) {
  const [state, formAction, isPending] = useActionState(updateSupplier, updateInitialState);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6"
    >
      <h2 className="text-sm font-medium text-foreground">Paramètres</h2>
      {state.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <input type="hidden" name="supplierId" value={supplierId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="delaiLivraisonJours">Délai de livraison (jours)</Label>
        <Input
          id="delaiLivraisonJours"
          name="delaiLivraisonJours"
          type="number"
          defaultValue={delaiLivraisonJours ?? ""}
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input type="checkbox" name="actif" defaultChecked={actif} className="size-4" />
        Fournisseur actif
      </label>
      <Button type="submit" className="self-start" disabled={isPending}>
        {isPending ? "Enregistrement..." : "Mettre à jour"}
      </Button>
    </form>
  );
}

export function SupplierProductForm({
  supplierId,
  variants,
}: {
  supplierId: string;
  variants: { id: string; label: string }[];
}) {
  const [state, formAction, isPending] = useActionState(addSupplierProduct, productInitialState);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6"
    >
      <h2 className="text-sm font-medium text-foreground">Associer un produit</h2>
      {state.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <input type="hidden" name="supplierId" value={supplierId} />
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="variantId">Produit</Label>
          <select
            id="variantId"
            name="variantId"
            required
            className="h-8 rounded-md border border-border bg-background px-2.5 text-sm"
          >
            <option value="">Sélectionner...</option>
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prixAchatDernier">Prix d&apos;achat</Label>
          <Input id="prixAchatDernier" name="prixAchatDernier" type="number" step="0.01" required />
        </div>
        <label className="flex items-end gap-2 pb-1.5 text-sm text-foreground">
          <input type="checkbox" name="estPrefere" className="size-4" />
          Fournisseur préféré
        </label>
      </div>
      <Button type="submit" className="self-start" disabled={isPending}>
        {isPending ? "Ajout..." : "Associer"}
      </Button>
    </form>
  );
}
