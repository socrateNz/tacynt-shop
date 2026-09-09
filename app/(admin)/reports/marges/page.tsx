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
import { getMargesReport } from "@/lib/reports/marges";
import { parsePeriod } from "@/lib/reports/period";
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";

import { ExportButtons } from "../export-buttons";
import { PeriodFilter } from "../period-filter";
import { ShopFilter } from "../shop-filter";

export default async function MargesReportPage({
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
    (tx) => getMargesReport(tx, shopId, period.from, period.to),
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Marges</h1>
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
        rows={report.parProduit}
        columns={[
          { key: "designation", label: "Produit" },
          { key: "ca", label: "CA" },
          { key: "cout", label: "Coût" },
          { key: "marge", label: "Marge" },
          { key: "margePourcent", label: "Marge %" },
        ]}
        filename="marges-par-produit"
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-foreground">Par produit</h2>
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produit</TableHead>
                <TableHead className="text-right">CA</TableHead>
                <TableHead className="text-right">Coût</TableHead>
                <TableHead className="text-right">Marge</TableHead>
                <TableHead className="text-right">Marge %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.parProduit.map((r) => (
                <TableRow key={r.designation}>
                  <TableCell className="text-foreground">{r.designation}</TableCell>
                  <TableCell className="num text-right">{formatMoney(r.ca, organization.devise)}</TableCell>
                  <TableCell className="num text-right">{formatMoney(r.cout, organization.devise)}</TableCell>
                  <TableCell className="num text-right">{formatMoney(r.marge, organization.devise)}</TableCell>
                  <TableCell className="num text-right">{r.margePourcent.toFixed(1)}%</TableCell>
                </TableRow>
              ))}
              {report.parProduit.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Aucune vente sur la période.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-foreground">Par catégorie</h2>
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Catégorie</TableHead>
                <TableHead className="text-right">CA</TableHead>
                <TableHead className="text-right">Coût</TableHead>
                <TableHead className="text-right">Marge</TableHead>
                <TableHead className="text-right">Marge %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.parCategorie.map((r) => (
                <TableRow key={r.categorie}>
                  <TableCell className="text-foreground">{r.categorie}</TableCell>
                  <TableCell className="num text-right">{formatMoney(r.ca, organization.devise)}</TableCell>
                  <TableCell className="num text-right">{formatMoney(r.cout, organization.devise)}</TableCell>
                  <TableCell className="num text-right">{formatMoney(r.marge, organization.devise)}</TableCell>
                  <TableCell className="num text-right">{r.margePourcent.toFixed(1)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
