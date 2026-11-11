import { redirect } from "next/navigation";

import { Page, PageHeader, StatCard, TablePanel, Toolbar } from "@/components/admin/page";
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
import { getActiveShopId, getAssignedShopIds } from "@/lib/tenant/active-shop";
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
    redirect("/dashboard");
  }

  const sp = await searchParams;
  const period = parsePeriod(sp);
  // "Toutes les boutiques" ne consolide plus que les boutiques auxquelles CET
  // utilisateur est affecté, jamais toutes celles de l'organisation : sans
  // ça, un Gérant/Comptable affecté à une seule boutique verrait les
  // chiffres de boutiques dont il n'a jamais eu la charge en tapant
  // simplement ?shop=all dans l'URL (rien ne validait ce paramètre).
  const myShopIds = await getAssignedShopIds(ctx.organizationId, ctx.userId);
  const activeShopId = await getActiveShopId(ctx.organizationId, ctx.userId);
  const consolidated = sp.shop === "all" && myShopIds.length > 1;
  const shopId = consolidated ? myShopIds : activeShopId;

  const organization = await systemPrisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
  });

  const report = await withTenantContext(
    typeof shopId === "string"
      ? { organizationId: ctx.organizationId, shopId }
      : { organizationId: ctx.organizationId },
    (tx) => getTresorerieReport(tx, shopId, period.from, period.to),
  );

  return (
    <Page>
      <PageHeader
        back={{ href: "/reports", label: "Rapports" }}
        title="Trésorerie"
        description={<>Du {period.fromInput} au {period.toInput} — dépenses validées uniquement</>}
        actions={
          <ExportButtons
            rows={report.encaissementsParMode}
            columns={[
              { key: "mode", label: "Mode" },
              { key: "montant", label: "Montant", format: "money" },
            ]}
            filename="tresorerie-encaissements"
            pdf={{
              title: "Trésorerie — Encaissements par mode",
              subtitle: `Du ${period.fromInput} au ${period.toInput} — dépenses validées uniquement`,
              organizationNom: organization.nom,
              devise: organization.devise,
              summary: [
                { label: "Encaissements", value: formatMoney(report.totalEncaissements, organization.devise) },
                { label: "Dépenses", value: formatMoney(report.totalDepenses, organization.devise) },
                { label: "Solde net", value: formatMoney(report.soldeNet, organization.devise) },
              ],
            }}
          />
        }
      />

      <Toolbar>
        {myShopIds.length > 1 && <ShopFilter consolidated={consolidated} />}
        <PeriodFilter fromInput={period.fromInput} toInput={period.toInput} />
      </Toolbar>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Encaissements" value={formatMoney(report.totalEncaissements, organization.devise)} />
        <StatCard label="Dépenses" value={formatMoney(report.totalDepenses, organization.devise)} />
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <p className="text-xs font-medium text-muted-foreground uppercase">Solde net</p>
          <p
            className={`num text-2xl font-semibold ${report.soldeNet >= 0 ? "text-success" : "text-destructive"}`}
          >
            {formatMoney(report.soldeNet, organization.devise)}
          </p>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-foreground">Encaissements par mode</h2>
        </div>
        <TablePanel>
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
        </TablePanel>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-foreground">Dépenses par catégorie</h2>
        <TablePanel>
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
        </TablePanel>
      </section>
    </Page>
  );
}
