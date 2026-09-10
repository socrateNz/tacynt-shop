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
import { resolveAccountingMapping } from "@/lib/reports/accounting-mapping";
import { getAccountingJournal } from "@/lib/reports/accounting";
import { parsePeriod } from "@/lib/reports/period";
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";
import { organizationHasModule } from "@/lib/tenant/modules";
import { parseOrgSettings } from "@/lib/tenant/settings";

import { ExportButtons } from "../export-buttons";
import { PeriodFilter } from "../period-filter";
import { ShopFilter } from "../shop-filter";

export default async function ComptabiliteReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; shop?: string }>;
}) {
  const ctx = await getTenantContext();
  const organization = await systemPrisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
  });

  // Deux axes distincts, jamais confondus (Phase 4, décision #2) : la
  // capacité du rôle ET le module payé par l'organisation.
  if (
    !hasCapability(ctx.role, "accounting:manage") ||
    !organizationHasModule(organization.enabledModules, "accounting_connectors")
  ) {
    redirect("/reports");
  }

  const sp = await searchParams;
  const period = parsePeriod(sp);
  const consolidated = sp.shop === "all";
  const activeShopId = await getActiveShopId(ctx.organizationId, ctx.userId);
  const shopId = consolidated ? null : activeShopId;

  const shopCount = await withTenantContext({ organizationId: ctx.organizationId }, (tx) =>
    tx.shop.count({ where: { actif: true } }),
  );

  const mapping = resolveAccountingMapping(parseOrgSettings(organization.settings));

  const journal = await withTenantContext(
    shopId ? { organizationId: ctx.organizationId, shopId } : { organizationId: ctx.organizationId },
    (tx) => getAccountingJournal(tx, shopId, period.from, period.to, mapping),
  );

  const totalDebit = journal.reduce((sum, l) => sum + l.montant, 0);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Comptabilité</h1>
          <p className="text-sm text-muted-foreground">
            Du {period.fromInput} au {period.toInput} — export uniquement, aucune intégration
            comptable en direct.
          </p>
        </div>
        <div className="no-print flex items-center gap-2">
          {shopCount > 1 && <ShopFilter consolidated={consolidated} />}
          <PeriodFilter fromInput={period.fromInput} toInput={period.toInput} />
        </div>
      </header>

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-medium text-muted-foreground uppercase">
          Total du journal (débit = crédit)
        </p>
        <p className="num text-2xl font-semibold text-foreground">
          {formatMoney(totalDebit, organization.devise)}
        </p>
      </div>

      <ExportButtons
        rows={journal}
        columns={[
          { key: "date", label: "Date" },
          { key: "piece", label: "Pièce" },
          { key: "compteDebit", label: "Compte débit" },
          { key: "compteCredit", label: "Compte crédit" },
          { key: "montant", label: "Montant" },
          { key: "libelle", label: "Libellé" },
        ]}
        filename="journal-comptable"
      />

      <section className="flex flex-col gap-3">
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Pièce</TableHead>
                <TableHead>Débit</TableHead>
                <TableHead>Crédit</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Libellé</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {journal.map((l, i) => (
                <TableRow key={`${l.piece}-${i}`}>
                  <TableCell className="text-muted-foreground">{l.date}</TableCell>
                  <TableCell className="text-muted-foreground">{l.piece}</TableCell>
                  <TableCell className="num text-foreground">{l.compteDebit}</TableCell>
                  <TableCell className="num text-foreground">{l.compteCredit}</TableCell>
                  <TableCell className="num text-right">
                    {formatMoney(l.montant, organization.devise)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{l.libelle}</TableCell>
                </TableRow>
              ))}
              {journal.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Aucune écriture sur la période.
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
