import { Eye } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { getTenantContext } from "@/lib/tenant/context";

import { SupplierForm } from "./supplier-form";

export default async function SuppliersPage() {
  const ctx = await getTenantContext();
  if (!hasCapability(ctx.role, "suppliers:manage")) {
    redirect("/");
  }

  const organization = await systemPrisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
  });

  const [suppliers, balances] = await withTenantContext(
    { organizationId: ctx.organizationId },
    async (tx) => {
      const suppliers = await tx.supplier.findMany({ orderBy: { nom: "asc" } });
      const balances = await tx.supplierLedger.groupBy({
        by: ["supplierId"],
        _sum: { montant: true },
      });
      return [suppliers, balances] as const;
    },
  );

  const balanceBySupplier = new Map(
    balances.map((b) => [b.supplierId, Number(b._sum.montant ?? 0)]),
  );

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Fournisseurs</h1>
        <p className="text-sm text-muted-foreground">
          Commandes, réceptions et dette fournisseur — le solde est un journal, pas une valeur
          écrite directement.
        </p>
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
              return (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link
                      href={`/suppliers/${s.id}`}
                      className="text-foreground underline-offset-4 hover:underline"
                    >
                      {s.nom}
                    </Link>
                  </TableCell>
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
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      nativeButton={false}
                      render={<Link href={`/suppliers/${s.id}`} />}
                    >
                      <Eye className="size-3.5" />
                      <span className="sr-only">Voir</span>
                    </Button>
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

      <SupplierForm />
    </div>
  );
}
