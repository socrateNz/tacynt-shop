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
import { parsePeriod } from "@/lib/reports/period";
import { getTresorerieReport } from "@/lib/reports/tresorerie";
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";

import { ExportButtons } from "../export-buttons";
import { PeriodFilter } from "../period-filter";
import { ShopFilter } from "../shop-filter";

export default async function TresorerieReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; shop?: string }>;
}) {
  const ctx = await getTenantContext();
  if (!hasCapability(ctx.role, "reports:read")) {
    redirect("/");
  }

  const sp = await searchParams;
  const period = parsePeriod(sp);
  const consolidated = sp.shop === "all";
  const activeShopId = await getActiveShopId(ctx.organizationId, ctx.userId);
  const shopId = consolidated ? null : activeShopId;

  const [organization, shopCount] = await Promise.all([
    systemPrisma.organization.findUniqueOrThrow({ where: { id: ctx.organizationId } }),
    withTenantContext({ organizationId: ctx.organizationId }, (tx) =>
      tx.shop.count({ where: { actif: true } }),
    ),
  ]);

  const report = await withTenantContext(
    shopId ? { organizationId: ctx.organizationId, shopId } : { organizationId: ctx.organizationId },
    (tx) => getTresorerieReport(tx, shopId, period.from, period.to),
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Trésorerie</h1>
          <p className="text-sm text-muted-foreground">
            Du {period.fromInput} au {period.toInput} — dépenses validées uniquement
          </p>
        </div>
        <div className="no-print flex items-center gap-2">
          {shopCount > 1 && <ShopFilter consolidated={consolidated} />}
          <PeriodFilter fromInput={period.fromInput} toInput={period.toInput} />
        </div>
      </header>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase">Encaissements</p>
          <p className="num text-2xl font-semibold text-foreground">
            {formatMoney(report.totalEncaissements, organization.devise)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase">Dépenses</p>
          <p className="num text-2xl font-semibold text-foreground">
            {formatMoney(report.totalDepenses, organization.devise)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase">Solde net</p>
          <p
            className={`num text-2xl font-semibold ${report.soldeNet >= 0 ? "text-success" : "text-destructive"}`}
          >
            {formatMoney(report.soldeNet, organization.devise)}
          </p>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground">Encaissements par mode</h2>
          <ExportButtons
            rows={report.encaissementsParMode}
            columns={[
              { key: "mode", label: "Mode" },
              { key: "montant", label: "Montant" },
            ]}
            filename="tresorerie-encaissements"
          />
        </div>
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mode</TableHead>
                <TableHead className="text-right">Montant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.encaissementsParMode.map((r) => (
                <TableRow key={r.mode}>
                  <TableCell className="text-foreground">{r.mode}</TableCell>
                  <TableCell className="num text-right">
                    {formatMoney(r.montant, organization.devise)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-foreground">Dépenses par catégorie</h2>
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Catégorie</TableHead>
                <TableHead className="text-right">Montant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.depensesParCategorie.map((r) => (
                <TableRow key={r.categorie}>
                  <TableCell className="text-foreground">{r.categorie}</TableCell>
                  <TableCell className="num text-right">
                    {formatMoney(r.montant, organization.devise)}
                  </TableCell>
                </TableRow>
              ))}
              {report.depensesParCategorie.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground">
                    Aucune dépense validée sur la période.
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
