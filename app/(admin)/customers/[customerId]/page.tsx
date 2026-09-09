import { redirect } from "next/navigation";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCustomerBalance } from "@/lib/customers/ledger";
import { systemPrisma } from "@/lib/db/system-client";
import { withTenantContext } from "@/lib/db/tenant-context";
import { getLoyaltyBalance } from "@/lib/loyalty/ledger";
import { formatMoney } from "@/lib/money";
import { hasCapability } from "@/lib/permissions";
import { getTenantContext } from "@/lib/tenant/context";

import {
  CustomerSettingsForm,
  LoyaltyConversionForm,
  PaymentForm,
} from "./customer-detail-forms";

const LEDGER_TYPE_LABELS: Record<string, string> = {
  VENTE_ARDOISE: "Vente à crédit",
  PAIEMENT: "Paiement",
  AJUSTEMENT: "Ajustement",
  ANNULATION_VENTE: "Annulation de vente",
  UTILISATION_BON_ACHAT: "Utilisation bon d'achat",
};

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const ctx = await getTenantContext();
  if (!hasCapability(ctx.role, "customers:manage")) {
    redirect("/");
  }

  const { customerId } = await params;
  const organization = await systemPrisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
  });

  const [customer, ledgerEntries, solde, pointsBalance] = await withTenantContext(
    { organizationId: ctx.organizationId },
    async (tx) => {
      const customer = await tx.customer.findUniqueOrThrow({ where: { id: customerId } });
      const ledgerEntries = await tx.customerLedger.findMany({
        where: { customerId },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      const solde = await getCustomerBalance(tx, customerId);
      const pointsBalance = await getLoyaltyBalance(tx, customerId);
      return [customer, ledgerEntries, solde, pointsBalance] as const;
    },
  );

  const overLimit = solde > Number(customer.plafondCredit);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-xl font-semibold text-foreground">{customer.nom}</h1>
        <p className="text-sm text-muted-foreground">{customer.telephone ?? "Aucun téléphone"}</p>
      </header>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase">Solde actuel</p>
          <p className={`num text-2xl font-semibold ${overLimit ? "text-destructive" : "text-foreground"}`}>
            {formatMoney(solde, organization.devise)}
          </p>
          {overLimit && (
            <p className="mt-1 text-xs text-destructive">
              Plafond dépassé ({formatMoney(customer.plafondCredit, organization.devise)}).
            </p>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase">Plafond de crédit</p>
          <p className="num text-2xl font-semibold text-foreground">
            {formatMoney(customer.plafondCredit, organization.devise)}
          </p>
        </div>
      </div>

      <PaymentForm customerId={customer.id} />

      <LoyaltyConversionForm customerId={customer.id} pointsBalance={pointsBalance} />

      <CustomerSettingsForm
        customerId={customer.id}
        categorieTarif={customer.categorieTarif}
        plafondCredit={Number(customer.plafondCredit)}
        actif={customer.actif}
      />

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-foreground">Historique</h2>
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
