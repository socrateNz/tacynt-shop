"use client";

import { Eye } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { PurchaseOrderRow } from "./purchase-orders-dialog";
import { PurchaseOrdersDialog } from "./purchase-orders-dialog";
import { PurchaseOrderReceiveDialog } from "./purchase-order-receive-dialog";
import {
  SupplierPaymentForm,
  SupplierProductForm,
  SupplierSettingsForm,
} from "./supplier-detail-forms";

const LEDGER_TYPE_LABELS: Record<string, string> = {
  RECEPTION: "Réception",
  PAIEMENT: "Paiement",
  AJUSTEMENT: "Ajustement",
};

const STATUS_LABELS: Record<string, string> = {
  BROUILLON: "Brouillon",
  ENVOYEE: "Envoyée",
  RECUE_PARTIELLE: "Reçue partiellement",
  RECUE_COMPLETE: "Reçue complète",
  ANNULEE: "Annulée",
};

export type SupplierLedgerRow = {
  id: string;
  createdAtLabel: string;
  type: string;
  montant: number;
  montantLabel: string;
  motif: string | null;
};

export type SupplierProductRow = {
  key: string;
  designation: string;
  prixAchatDernierLabel: string;
  estPrefere: boolean;
};

export function SupplierDetailDialog({
  supplierId,
  nom,
  telephone,
  email,
  delaiLivraisonJours,
  actif,
  soldeLabel,
  ledgerEntries,
  supplierProducts,
  variants,
  purchaseOrders,
  reorderCandidates,
  poFormProducts,
  canPurchase,
}: {
  supplierId: string;
  nom: string;
  telephone: string | null;
  email: string | null;
  delaiLivraisonJours: number | null;
  actif: boolean;
  soldeLabel: string;
  ledgerEntries: SupplierLedgerRow[];
  supplierProducts: SupplierProductRow[];
  variants: { id: string; label: string }[];
  purchaseOrders: PurchaseOrderRow[];
  reorderCandidates: { label: string; quantite: number; seuil: number }[];
  poFormProducts: { variantId: string; label: string; prixAchatDernier: number }[];
  canPurchase: boolean;
}) {
  const recentPurchaseOrders = purchaseOrders.slice(0, 5);

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <Eye className="size-3.5" />
        <span className="sr-only">Voir</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{nom}</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            {telephone ?? "Aucun téléphone"}
            {email ? ` · ${email}` : ""}
          </p>
          {canPurchase && (
            <PurchaseOrdersDialog
              supplierId={supplierId}
              supplierNom={nom}
              purchaseOrders={purchaseOrders}
              reorderCandidates={reorderCandidates}
              products={poFormProducts}
            />
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase">Solde dû</p>
          <p className="num text-2xl font-semibold text-foreground">{soldeLabel}</p>
        </div>

        <SupplierPaymentForm supplierId={supplierId} />
        <SupplierSettingsForm
          supplierId={supplierId}
          delaiLivraisonJours={delaiLivraisonJours}
          actif={actif}
        />

        <section className="flex flex-col gap-4">
          <h3 className="text-sm font-medium text-foreground">Produits associés</h3>
          <div className="rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produit</TableHead>
                  <TableHead className="text-right">Dernier prix d&apos;achat</TableHead>
                  <TableHead>Préféré</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supplierProducts.map((sp) => (
                  <TableRow key={sp.key}>
                    <TableCell className="text-foreground">{sp.designation}</TableCell>
                    <TableCell className="num text-right">{sp.prixAchatDernierLabel}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {sp.estPrefere ? "Oui" : "Non"}
                    </TableCell>
                  </TableRow>
                ))}
                {supplierProducts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      Aucun produit associé.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <SupplierProductForm supplierId={supplierId} variants={variants} />
        </section>

        {canPurchase && (
          <section className="flex flex-col gap-4">
            <h3 className="text-sm font-medium text-foreground">Commandes récentes</h3>
            <div className="rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numéro</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentPurchaseOrders.map((po) => (
                    <TableRow key={po.id}>
                      <TableCell className="text-foreground">{po.numero}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {STATUS_LABELS[po.statut] ?? po.statut}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{po.dateLabel}</TableCell>
                      <TableCell className="text-right">
                        <PurchaseOrderReceiveDialog
                          purchaseOrderId={po.id}
                          numero={po.numero}
                          supplierNom={nom}
                          statut={po.statut}
                          lines={po.lines}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {recentPurchaseOrders.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        Aucune commande pour l&apos;instant.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </section>
        )}

        <section className="flex flex-col gap-4">
          <h3 className="text-sm font-medium text-foreground">Historique du solde</h3>
          <div className="rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Motif</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledgerEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-muted-foreground">
                      {entry.createdAtLabel}
                    </TableCell>
                    <TableCell className="text-foreground">
                      {LEDGER_TYPE_LABELS[entry.type] ?? entry.type}
                    </TableCell>
                    <TableCell
                      className={`num text-right ${entry.montant > 0 ? "text-destructive" : "text-success"}`}
                    >
                      {entry.montantLabel}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{entry.motif ?? "—"}</TableCell>
                  </TableRow>
                ))}
                {ledgerEntries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Aucun mouvement pour l&apos;instant.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}
