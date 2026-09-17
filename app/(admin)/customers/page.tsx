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
import { getTenantContext } from "@/lib/tenant/context";

import { CustomerDetailDialog } from "./customer-detail-dialog";
import { CustomerForm } from "./customer-form";

export default async function CustomersPage() {
  const ctx = await getTenantContext();
  if (!hasCapability(ctx.role, "customers:manage")) {
    redirect("/");
  }

  const organization = await systemPrisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
  });

  const [customers, balances, pointsBalances, ledgerByCustomer] = await withTenantContext(
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
      const ledgerEntries = await Promise.all(
        customers.map((c) =>
          tx.customerLedger.findMany({
            where: { customerId: c.id },
            orderBy: { createdAt: "desc" },
            take: 20,
          }),
        ),
      );
      const ledgerByCustomer = new Map(customers.map((c, i) => [c.id, ledgerEntries[i]]));
      return [customers, balances, pointsBalances, ledgerByCustomer] as const;
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
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Clients</h1>
          <p className="text-sm text-muted-foreground">
            Le solde d&apos;un client est la somme de son journal — jamais une valeur qu&apos;on
            écrit directement.
          </p>
        </div>
        <Dialog>
          <DialogTrigger render={<Button className="gap-1.5" />}>
            <Plus className="size-4" />
            Nouveau client
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Nouveau client</DialogTitle>
            </DialogHeader>
            <CustomerForm />
          </DialogContent>
        </Dialog>
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
              const overLimit = solde > Number(c.plafondCredit);
              const ledgerEntries = (ledgerByCustomer.get(c.id) ?? []).map((entry) => ({
                id: entry.id,
                createdAtLabel: entry.createdAt.toLocaleString("fr-FR"),
                type: entry.type,
                montant: Number(entry.montant),
                montantLabel: formatMoney(entry.montant, organization.devise),
                motif: entry.motif,
              }));
              return (
                <TableRow key={c.id}>
                  <TableCell className="text-foreground">{c.nom}</TableCell>
                  <TableCell className="text-muted-foreground">{c.telephone ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.categorieTarif || "—"}
                  </TableCell>
                  <TableCell className="num text-right">
                    {formatMoney(c.plafondCredit, organization.devise)}
                  </TableCell>
                  <TableCell
                    className={`num text-right ${overLimit ? "text-destructive" : "text-foreground"}`}
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
                    <CustomerDetailDialog
                      customerId={c.id}
                      nom={c.nom}
                      telephone={c.telephone}
                      categorieTarif={c.categorieTarif}
                      plafondCredit={Number(c.plafondCredit)}
                      plafondCreditLabel={formatMoney(c.plafondCredit, organization.devise)}
                      soldeLabel={formatMoney(solde, organization.devise)}
                      pointsBalance={pointsByCustomer.get(c.id) ?? 0}
                      overLimit={overLimit}
                      ledgerEntries={ledgerEntries}
                      actif={c.actif}
                    />
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
    </div>
  );
}
