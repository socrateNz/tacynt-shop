"use client";

import { ChevronRight } from "lucide-react";

import { TablePanel } from "@/components/admin/page";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import type { PurchaseOrderRow } from "./purchase-orders-dialog";
import { PurchaseOrdersDialog } from "./purchase-orders-dialog";
import { PurchaseOrderReceiveDialog } from "./purchase-order-receive-dialog";
import { SupplierPaymentForm, SupplierProductForm, SupplierSettingsForm } from "./supplier-detail-forms";

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
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        Ouvrir
        <ChevronRight className="size-3.5" />
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

        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <p className="text-xs font-medium text-muted-foreground uppercase">Solde dû</p>
          <p className="num text-2xl font-semibold text-foreground">{soldeLabel}</p>
        </div>

        <Tabs defaultValue="historique" className="flex flex-col gap-4">
          <TabsList className="max-w-full self-start overflow-x-auto">
            <TabsTab value="historique">Historique</TabsTab>
            <TabsTab value="paiement">Paiement</TabsTab>
            <TabsTab value="produits">Produits</TabsTab>
            {canPurchase && <TabsTab value="commandes">Commandes</TabsTab>}
            <TabsTab value="reglages">Réglages</TabsTab>
          </TabsList>
          <TabsPanel value="historique" className="flex flex-col gap-4">
            <section className="flex flex-col gap-4">
              <TablePanel>
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
                        <TableCell className="text-muted-foreground">{entry.createdAtLabel}</TableCell>
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
              </TablePanel>
            </section>
          </TabsPanel>
          <TabsPanel value="paiement" className="flex flex-col gap-4">
            <SupplierPaymentForm supplierId={supplierId} />
          </TabsPanel>
          <TabsPanel value="produits" className="flex flex-col gap-4">
            <section className="flex flex-col gap-4">
              <TablePanel>
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
                        <TableCell className="text-muted-foreground">{sp.estPrefere ? "Oui" : "Non"}</TableCell>
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
              </TablePanel>
              <SupplierProductForm supplierId={supplierId} variants={variants} />
            </section>
          </TabsPanel>
          <TabsPanel value="commandes" className="flex flex-col gap-4">
            {canPurchase && (
              <section className="flex flex-col gap-4">
                <TablePanel>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Numéro</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="w-12">
                          <span className="sr-only">Actions</span>
                        </TableHead>
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
                </TablePanel>
              </section>
            )}
          </TabsPanel>
          <TabsPanel value="reglages" className="flex flex-col gap-4">
            <SupplierSettingsForm supplierId={supplierId} delaiLivraisonJours={delaiLivraisonJours} actif={actif} />
          </TabsPanel>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
