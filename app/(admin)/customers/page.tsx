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

import { CustomerForm } from "./customer-form";

export default async function CustomersPage() {
  const ctx = await getTenantContext();
  if (!hasCapability(ctx.role, "customers:manage")) {
    redirect("/");
  }

  const organization = await systemPrisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
  });

  const [customers, balances, pointsBalances] = await withTenantContext(
    { organizationId: ctx.organizationId },
    async (tx) => {
      const customers = await tx.customer.findMany({ orderBy: { nom: "asc" } });
      const balances = await tx.customerLedger.groupBy({
        by: ["customerId"],
        _sum: { montant: true },
      });
      const pointsBalances = await tx.loyaltyLedger.groupBy({
        by: ["customerId"],
        _sum: { points: true },
      });
      return [customers, balances, pointsBalances] as const;
    },
  );

  const balanceByCustomer = new Map(
    balances.map((b) => [b.customerId, Number(b._sum.montant ?? 0)]),
  );
  const pointsByCustomer = new Map(
    pointsBalances.map((p) => [p.customerId, p._sum.points ?? 0]),
  );

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Clients</h1>
        <p className="text-sm text-muted-foreground">
          Le solde d&apos;un client est la somme de son journal — jamais une valeur qu&apos;on
          écrit directement.
        </p>
      </header>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead>Catégorie tarifaire</TableHead>
              <TableHead className="text-right">Plafond crédit</TableHead>
              <TableHead className="text-right">Solde</TableHead>
              <TableHead className="text-right">Points</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((c) => {
              const solde = balanceByCustomer.get(c.id) ?? 0;
              return (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link
                      href={`/customers/${c.id}`}
                      className="text-foreground underline-offset-4 hover:underline"
                    >
                      {c.nom}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.telephone ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.categorieTarif || "—"}
                  </TableCell>
                  <TableCell className="num text-right">
                    {formatMoney(c.plafondCredit, organization.devise)}
                  </TableCell>
                  <TableCell
                    className={`num text-right ${solde > Number(c.plafondCredit) ? "text-destructive" : "text-foreground"}`}
                  >
                    {formatMoney(solde, organization.devise)}
                  </TableCell>
                  <TableCell className="num text-right">
                    {pointsByCustomer.get(c.id) ?? 0}
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.actif ? "success" : "secondary"}>
                      {c.actif ? "Actif" : "Inactif"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      nativeButton={false}
                      render={<Link href={`/customers/${c.id}`} />}
                    >
                      <Eye className="size-3.5" />
                      <span className="sr-only">Voir</span>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {customers.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Aucun client pour l&apos;instant.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <CustomerForm />
    </div>
  );
}
