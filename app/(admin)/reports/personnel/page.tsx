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
import { getPersonnelReport } from "@/lib/reports/personnel";
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";

import { ExportButtons } from "../export-buttons";
import { PeriodFilter } from "../period-filter";
import { ShopFilter } from "../shop-filter";

export default async function PersonnelReportPage({
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
    (tx) => getPersonnelReport(tx, shopId, period.from, period.to),
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Personnel</h1>
          <p className="text-sm text-muted-foreground">
            Du {period.fromInput} au {period.toInput}
          </p>
        </div>
        <div className="no-print flex items-center gap-2">
          {shopCount > 1 && <ShopFilter consolidated={consolidated} />}
          <PeriodFilter fromInput={period.fromInput} toInput={period.toInput} />
        </div>
      </header>

      <ExportButtons
        rows={report.parVendeur}
        columns={[
          { key: "email", label: "Vendeur" },
          { key: "ca", label: "CA" },
          { key: "tickets", label: "Tickets" },
          { key: "remises", label: "Remises accordées" },
          { key: "annulations", label: "Annulations" },
        ]}
        filename="personnel"
      />

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendeur</TableHead>
              <TableHead className="text-right">CA</TableHead>
              <TableHead className="text-right">Tickets</TableHead>
              <TableHead className="text-right">Remises accordées</TableHead>
              <TableHead className="text-right">Annulations</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.parVendeur.map((r) => (
              <TableRow key={r.userId}>
                <TableCell className="text-foreground">{r.email}</TableCell>
                <TableCell className="num text-right">{formatMoney(r.ca, organization.devise)}</TableCell>
                <TableCell className="num text-right">{r.tickets}</TableCell>
                <TableCell className="num text-right">
                  {formatMoney(r.remises, organization.devise)}
                </TableCell>
                <TableCell
                  className={`num text-right ${r.annulations > 0 ? "text-destructive" : ""}`}
                >
                  {r.annulations}
                </TableCell>
              </TableRow>
            ))}
            {report.parVendeur.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Aucune activité sur la période.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
