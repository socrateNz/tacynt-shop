import { Plus } from "lucide-react";
import { redirect } from "next/navigation";

import { Page, PageHeader, TablePanel } from "@/components/admin/page";
import { matchesQuery, SearchForm } from "@/components/admin/search-form";
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

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const query = ((await searchParams).q ?? "").trim();
  const ctx = await getTenantContext();
  if (!hasCapability(ctx.role, "customers:manage")) {
    redirect("/dashboard");
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

  const visible = customers.filter((x) => matchesQuery(query, x.nom, x.telephone));

  return (
    <Page>
      <PageHeader
        title="Clients"
        description="Fiches clients, crédit (ardoise) et points de fidélité."
        actions={
          <>
            <Dialog>
              <DialogTrigger render={<Button />}>
                <Plus />
                Nouveau client
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Nouveau client</DialogTitle>
                </DialogHeader>
                <CustomerForm />
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <SearchForm query={query} placeholder="Nom ou téléphone…" resetHref="/customers" />

      <TablePanel>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead className="hidden lg:table-cell">Catégorie tarifaire</TableHead>
              <TableHead className="hidden text-right md:table-cell">Plafond crédit</TableHead>
              <TableHead className="text-right">Solde</TableHead>
              <TableHead className="hidden text-right md:table-cell">Points</TableHead>
              <TableHead className="hidden sm:table-cell">Statut</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((c) => {
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
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{c.nom}</span>
                      <span className="text-xs text-muted-foreground">{c.telephone ?? "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">
                    {c.categorieTarif || "—"}
                  </TableCell>
                  <TableCell className="num hidden text-right md:table-cell">
                    {formatMoney(c.plafondCredit, organization.devise)}
                  </TableCell>
                  <TableCell
                    className={`num text-right ${overLimit ? "text-destructive" : "text-foreground"}`}
                  >
                    {formatMoney(solde, organization.devise)}
                  </TableCell>
                  <TableCell className="num hidden text-right md:table-cell">
                    {pointsByCustomer.get(c.id) ?? 0}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
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
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  {query ? "Aucun client ne correspond à cette recherche." : "Aucun client pour l'instant. Ajoutez-en un avec « Nouveau client »."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TablePanel>
    </Page>
  );
}
