import Link from "next/link";
import { redirect } from "next/navigation";

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
import { getSupplierBalance } from "@/lib/suppliers/ledger";
import { getTenantContext } from "@/lib/tenant/context";

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

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ supplierId: string }>;
}) {
  const ctx = await getTenantContext();
  if (!hasCapability(ctx.role, "suppliers:manage")) {
    redirect("/");
  }

  const { supplierId } = await params;
  const organization = await systemPrisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
  });

  const [supplier, ledgerEntries, solde, supplierProducts, variants, purchaseOrders] =
    await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
      const supplier = await tx.supplier.findUniqueOrThrow({ where: { id: supplierId } });
      const ledgerEntries = await tx.supplierLedger.findMany({
        where: { supplierId },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      const solde = await getSupplierBalance(tx, supplierId);
      const supplierProducts = await tx.supplierProduct.findMany({
        where: { supplierId },
        include: { variant: { include: { product: true } } },
      });
      const variants = await tx.productVariant.findMany({
        where: { actif: true },
        include: { product: true },
        orderBy: { product: { designation: "asc" } },
      });
      const purchaseOrders = await tx.purchaseOrder.findMany({
        where: { supplierId },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
      return [supplier, ledgerEntries, solde, supplierProducts, variants, purchaseOrders] as const;
    });

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{supplier.nom}</h1>
          <p className="text-sm text-muted-foreground">
            {supplier.telephone ?? "Aucun téléphone"}
            {supplier.email ? ` · ${supplier.email}` : ""}
          </p>
        </div>
        <Link
          href={`/suppliers/${supplier.id}/purchase-orders`}
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          Commandes →
        </Link>
      </header>

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-medium text-muted-foreground uppercase">Solde dû</p>
        <p className="num text-2xl font-semibold text-foreground">
          {formatMoney(solde, organization.devise)}
        </p>
      </div>

      <SupplierPaymentForm supplierId={supplier.id} />
      <SupplierSettingsForm
        supplierId={supplier.id}
        delaiLivraisonJours={supplier.delaiLivraisonJours}
        actif={supplier.actif}
      />

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-foreground">Produits associés</h2>
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
                <TableRow key={`${sp.supplierId}-${sp.variantId}`}>
                  <TableCell className="text-foreground">{sp.variant.product.designation}</TableCell>
                  <TableCell className="num text-right">
                    {formatMoney(sp.prixAchatDernier, organization.devise)}
                  </TableCell>
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
        <SupplierProductForm
          supplierId={supplier.id}
          variants={variants.map((v) => ({ id: v.id, label: v.product.designation }))}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-foreground">Commandes récentes</h2>
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numéro</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchaseOrders.map((po) => (
                <TableRow key={po.id}>
                  <TableCell>
                    <Link
                      href={`/purchase-orders/${po.id}/receive`}
                      className="text-foreground underline-offset-4 hover:underline"
                    >
                      {po.numero}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{po.statut}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {po.createdAt.toLocaleDateString("fr-FR")}
                  </TableCell>
                </TableRow>
              ))}
              {purchaseOrders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    Aucune commande pour l&apos;instant.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-foreground">Historique du solde</h2>
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
                    {entry.createdAt.toLocaleString("fr-FR")}
                  </TableCell>
                  <TableCell className="text-foreground">
                    {LEDGER_TYPE_LABELS[entry.type] ?? entry.type}
                  </TableCell>
                  <TableCell
                    className={`num text-right ${Number(entry.montant) > 0 ? "text-destructive" : "text-success"}`}
                  >
                    {formatMoney(entry.montant, organization.devise)}
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
    </div>
  );
}
