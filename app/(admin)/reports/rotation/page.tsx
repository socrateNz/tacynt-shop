import { redirect } from "next/navigation";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { withTenantContext } from "@/lib/db/tenant-context";
import { hasCapability } from "@/lib/permissions";
import { parsePeriod } from "@/lib/reports/period";
import { getRotationReport } from "@/lib/reports/rotation";
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";

import { ExportButtons } from "../export-buttons";
import { PeriodFilter } from "../period-filter";
import { ShopFilter } from "../shop-filter";

export default async function RotationReportPage({
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

  const shopCount = await withTenantContext({ organizationId: ctx.organizationId }, (tx) =>
    tx.shop.count({ where: { actif: true } }),
  );

  const report = await withTenantContext(
    shopId ? { organizationId: ctx.organizationId, shopId } : { organizationId: ctx.organizationId },
    (tx) => getRotationReport(tx, shopId, period.from, period.to),
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Rotation</h1>
          <p className="text-sm text-muted-foreground">
            Du {period.fromInput} au {period.toInput}
          </p>
        </div>
        <div className="no-print flex items-center gap-2">
          {shopCount > 1 && <ShopFilter consolidated={consolidated} />}
          <PeriodFilter fromInput={period.fromInput} toInput={period.toInput} />
        </div>
      </header>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground">Produits les plus vendus</h2>
          <ExportButtons
            rows={report.plusVendus}
            columns={[
              { key: "designation", label: "Produit" },
              { key: "quantiteVendue", label: "Quantité vendue" },
            ]}
            filename="rotation-plus-vendus"
          />
        </div>
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produit</TableHead>
                <TableHead className="text-right">Quantité vendue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.plusVendus.map((r) => (
                <TableRow key={r.designation}>
                  <TableCell className="text-foreground">{r.designation}</TableCell>
                  <TableCell className="num text-right">{r.quantiteVendue}</TableCell>
                </TableRow>
              ))}
              {report.plusVendus.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground">
                    Aucune vente sur la période.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-foreground">
          Produits dormants (aucune vente sur la période)
        </h2>
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produit</TableHead>
                <TableHead className="text-right">Stock actuel</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.dormants.map((r) => (
                <TableRow key={r.designation}>
                  <TableCell className="text-foreground">{r.designation}</TableCell>
                  <TableCell className="num text-right">{r.stockActuel}</TableCell>
                </TableRow>
              ))}
              {report.dormants.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground">
                    Aucun produit dormant.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-foreground">Taux de rotation</h2>
        <p className="text-xs text-muted-foreground">
          Quantité vendue sur la période ÷ stock actuel — un taux élevé signale un produit qui
          tourne vite.
        </p>
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produit</TableHead>
                <TableHead className="text-right">Vendu</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Taux</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.tauxRotation.map((r) => (
                <TableRow key={r.designation}>
                  <TableCell className="text-foreground">{r.designation}</TableCell>
                  <TableCell className="num text-right">{r.quantiteVendue}</TableCell>
                  <TableCell className="num text-right">{r.stockActuel}</TableCell>
                  <TableCell className="num text-right">{r.taux.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
