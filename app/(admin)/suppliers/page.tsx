import { Plus } from "lucide-react";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
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
import { systemPrisma } from "@/lib/db/system-client";
import { withTenantContext } from "@/lib/db/tenant-context";
import { formatMoney } from "@/lib/money";
import { hasCapability } from "@/lib/permissions";
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";

import { SupplierDetailDialog } from "./supplier-detail-dialog";
import { SupplierForm } from "./supplier-form";

export default async function SuppliersPage() {
  const ctx = await getTenantContext();
  if (!hasCapability(ctx.role, "suppliers:manage")) {
    redirect("/dashboard");
  }

  const canPurchase = hasCapability(ctx.role, "purchasing:manage");
  const shopId = await getActiveShopId(ctx.organizationId, ctx.userId);
  const organization = await systemPrisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
  });

  const {
    suppliers,
    balanceBySupplier,
    ledgerBySupplier,
    productsBySupplier,
    posBySupplier,
    reorderBySupplier,
    allVariants,
    receivedByPoVariant,
  } = await withTenantContext({ organizationId: ctx.organizationId, shopId }, async (tx) => {
    const suppliers = await tx.supplier.findMany({ orderBy: { nom: "asc" } });
    const supplierIds = suppliers.map((s) => s.id);

    const balances = await tx.supplierLedger.groupBy({
      by: ["supplierId"],
      _sum: { montant: true },
    });
    const balanceBySupplier = new Map(
      balances.map((b) => [b.supplierId, Number(b._sum.montant ?? 0)]),
    );

    const ledgerEntries = supplierIds.length
      ? await tx.supplierLedger.findMany({
          where: { supplierId: { in: supplierIds } },
          orderBy: { createdAt: "desc" },
          take: 500,
        })
      : [];
    const ledgerBySupplier = new Map<string, typeof ledgerEntries>();
    for (const entry of ledgerEntries) {
      const list = ledgerBySupplier.get(entry.supplierId) ?? [];
      if (list.length < 20) list.push(entry);
      ledgerBySupplier.set(entry.supplierId, list);
    }

    const supplierProducts = supplierIds.length
      ? await tx.supplierProduct.findMany({
          where: { supplierId: { in: supplierIds } },
          include: { variant: { include: { product: true } } },
        })
      : [];
    const productsBySupplier = new Map<string, typeof supplierProducts>();
    for (const sp of supplierProducts) {
      const list = productsBySupplier.get(sp.supplierId) ?? [];
      list.push(sp);
      productsBySupplier.set(sp.supplierId, list);
    }

    const purchaseOrders = supplierIds.length
      ? await tx.purchaseOrder.findMany({
          where: { supplierId: { in: supplierIds } },
          orderBy: { createdAt: "desc" },
          include: { lines: { include: { variant: { include: { product: true } } } } },
        })
      : [];
    const poIds = purchaseOrders.map((po) => po.id);
    const receiptLines = poIds.length
      ? await tx.goodsReceiptLine.findMany({
          where: { goodsReceipt: { purchaseOrderId: { in: poIds } } },
          include: { goodsReceipt: true },
        })
      : [];
    const receivedByPoVariant = new Map<string, number>();
    for (const l of receiptLines) {
      const key = `${l.goodsReceipt.purchaseOrderId}:${l.variantId}`;
      receivedByPoVariant.set(key, (receivedByPoVariant.get(key) ?? 0) + Number(l.quantiteRecue));
    }
    const posBySupplier = new Map<string, typeof purchaseOrders>();
    for (const po of purchaseOrders) {
      const list = posBySupplier.get(po.supplierId) ?? [];
      list.push(po);
      posBySupplier.set(po.supplierId, list);
    }

    const variantIds = [...new Set(supplierProducts.map((sp) => sp.variantId))];
    const stockLevels = variantIds.length
      ? await tx.stockLevel.findMany({ where: { shopId, variantId: { in: variantIds } } })
      : [];
    const shopPrices = variantIds.length
      ? await tx.shopPrice.findMany({ where: { shopId, variantId: { in: variantIds } } })
      : [];
    const stockByVariant = new Map(stockLevels.map((sl) => [sl.variantId, Number(sl.quantite)]));
    const seuilByVariant = new Map(shopPrices.map((sp) => [sp.variantId, sp.seuilAlerte]));

    const reorderBySupplier = new Map<string, { label: string; quantite: number; seuil: number }[]>();
    for (const sp of supplierProducts) {
      const seuil = seuilByVariant.get(sp.variantId) ?? null;
      const quantite = stockByVariant.get(sp.variantId) ?? 0;
      if (seuil !== null && quantite <= seuil) {
        const list = reorderBySupplier.get(sp.supplierId) ?? [];
        list.push({ label: sp.variant.product.designation, quantite, seuil });
        reorderBySupplier.set(sp.supplierId, list);
      }
    }

    const allVariants = await tx.productVariant.findMany({
      where: { actif: true },
      include: { product: true },
      orderBy: { product: { designation: "asc" } },
    });

    return {
      suppliers,
      balanceBySupplier,
      ledgerBySupplier,
      productsBySupplier,
      posBySupplier,
      reorderBySupplier,
      allVariants,
      receivedByPoVariant,
    };
  });

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Fournisseurs</h1>
          <p className="text-sm text-muted-foreground">
            Commandes, réceptions et dette fournisseur — le solde est un journal, pas une valeur
            écrite directement.
          </p>
        </div>
        <Dialog>
          <DialogTrigger render={<Button className="gap-1.5" />}>
            <Plus className="size-4" />
            Nouveau fournisseur
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Nouveau fournisseur</DialogTitle>
            </DialogHeader>
            <SupplierForm />
          </DialogContent>
        </Dialog>
      </header>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead>Délai livraison</TableHead>
              <TableHead className="text-right">Solde dû</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.map((s) => {
              const solde = balanceBySupplier.get(s.id) ?? 0;
              const ledgerEntries = (ledgerBySupplier.get(s.id) ?? []).map((entry) => ({
                id: entry.id,
                createdAtLabel: entry.createdAt.toLocaleString("fr-FR"),
                type: entry.type,
                montant: Number(entry.montant),
                montantLabel: formatMoney(entry.montant, organization.devise),
                motif: entry.motif,
              }));
              const supplierProducts = (productsBySupplier.get(s.id) ?? []).map((sp) => ({
                key: `${sp.supplierId}-${sp.variantId}`,
                designation: sp.variant.product.designation,
                prixAchatDernierLabel: formatMoney(sp.prixAchatDernier, organization.devise),
                estPrefere: sp.estPrefere,
              }));
              const purchaseOrders = (posBySupplier.get(s.id) ?? []).map((po) => ({
                id: po.id,
                numero: po.numero,
                statut: po.statut,
                dateLabel: po.createdAt.toLocaleDateString("fr-FR"),
                lines: po.lines.map((l) => ({
                  variantId: l.variantId,
                  designation: l.variant.product.designation,
                  quantiteCommandee: Number(l.quantiteCommandee),
                  dejaRecue: receivedByPoVariant.get(`${po.id}:${l.variantId}`) ?? 0,
                  prixUnitaireCommande: Number(l.prixUnitaireCommande),
                })),
              }));
              const poFormProducts = (productsBySupplier.get(s.id) ?? []).map((sp) => ({
                variantId: sp.variantId,
                label: sp.variant.product.designation,
                prixAchatDernier: Number(sp.prixAchatDernier),
              }));

              return (
                <TableRow key={s.id}>
                  <TableCell className="text-foreground">{s.nom}</TableCell>
                  <TableCell className="text-muted-foreground">{s.telephone ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.delaiLivraisonJours !== null ? `${s.delaiLivraisonJours} j` : "—"}
                  </TableCell>
                  <TableCell className="num text-right">
                    {formatMoney(solde, organization.devise)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.actif ? "success" : "secondary"}>
                      {s.actif ? "Actif" : "Inactif"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <SupplierDetailDialog
                      supplierId={s.id}
                      nom={s.nom}
                      telephone={s.telephone}
                      email={s.email}
                      delaiLivraisonJours={s.delaiLivraisonJours}
                      actif={s.actif}
                      soldeLabel={formatMoney(solde, organization.devise)}
                      ledgerEntries={ledgerEntries}
                      supplierProducts={supplierProducts}
                      variants={allVariants.map((v) => ({ id: v.id, label: v.product.designation }))}
                      purchaseOrders={purchaseOrders}
                      reorderCandidates={reorderBySupplier.get(s.id) ?? []}
                      poFormProducts={poFormProducts}
                      canPurchase={canPurchase}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
            {suppliers.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Aucun fournisseur pour l&apos;instant.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
