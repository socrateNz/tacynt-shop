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
import { getStockReport } from "@/lib/reports/stock";
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";

import { ExportButtons } from "../export-buttons";
import { PeriodFilter } from "../period-filter";

export default async function StockReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const ctx = await getTenantContext();
  if (!hasCapability(ctx.role, "reports:read")) {
    redirect("/");
  }

  const period = parsePeriod(await searchParams);
  const shopId = await getActiveShopId(ctx.organizationId, ctx.userId);
  const organization = await systemPrisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
  });

  const report = await withTenantContext(
    { organizationId: ctx.organizationId, shopId },
    (tx) => getStockReport(tx, shopId, period.from, period.to),
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Stock</h1>
          <p className="text-sm text-muted-foreground">
            Écarts et mouvements du {period.fromInput} au {period.toInput}
          </p>
        </div>
        <div className="no-print">
          <PeriodFilter fromInput={period.fromInput} toInput={period.toInput} />
        </div>
      </header>

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-medium text-muted-foreground uppercase">
          Valorisation totale du stock (instantané)
        </p>
        <p className="num text-2xl font-semibold text-foreground">
          {formatMoney(report.valorisationTotale, organization.devise)}
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground">Écarts d&apos;inventaire</h2>
          <ExportButtons
            rows={report.ecartsInventaire}
            columns={[
              { key: "produit", label: "Produit" },
              { key: "theorique", label: "Théorique" },
              { key: "compte", label: "Compté" },
              { key: "ecart", label: "Écart" },
            ]}
            filename="stock-ecarts-inventaire"
          />
        </div>
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produit</TableHead>
                <TableHead className="text-right">Théorique</TableHead>
                <TableHead className="text-right">Compté</TableHead>
                <TableHead className="text-right">Écart</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.ecartsInventaire.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="text-foreground">{r.produit}</TableCell>
                  <TableCell className="num text-right">{r.theorique}</TableCell>
                  <TableCell className="num text-right">{r.compte}</TableCell>
                  <TableCell
                    className={`num text-right ${r.ecart !== 0 ? "text-destructive" : ""}`}
                  >
                    {r.ecart}
                  </TableCell>
                </TableRow>
              ))}
              {report.ecartsInventaire.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Aucun écart sur la période.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-foreground">Historique des mouvements</h2>
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Produit</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Quantité</TableHead>
                <TableHead className="text-right">Coût unitaire</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.mouvements.map((m, i) => (
                <TableRow key={i}>
                  <TableCell className="text-muted-foreground">
                    {m.createdAt.toLocaleString("fr-FR")}
                  </TableCell>
                  <TableCell className="text-foreground">{m.produit}</TableCell>
                  <TableCell className="text-muted-foreground">{m.type}</TableCell>
                  <TableCell className="num text-right">{m.quantite}</TableCell>
                  <TableCell className="num text-right">
                    {formatMoney(m.coutUnitaire, organization.devise)}
                  </TableCell>
                </TableRow>
              ))}
              {report.mouvements.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Aucun mouvement sur la période.
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
