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
import { getStockReport } from "@/lib/reports/stock";
import { getActiveShopId, getAssignedShopIds } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";

import { ExportButtons } from "../export-buttons";
import { PeriodFilter } from "../period-filter";
import { ShopFilter } from "../shop-filter";

export default async function StockReportPage({
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
    (tx) => getStockReport(tx, shopId, period.from, period.to),
  );

  return (
    <Page>
      <PageHeader
        back={{ href: "/reports", label: "Rapports" }}
        title="Stock"
        description={<>Écarts et mouvements du {period.fromInput} au {period.toInput}</>}
        actions={
          <ExportButtons
            rows={report.ecartsInventaire}
            columns={[
              { key: "produit", label: "Produit" },
              { key: "theorique", label: "Théorique", format: "number" },
              { key: "compte", label: "Compté", format: "number" },
              { key: "ecart", label: "Écart", format: "number" },
            ]}
            filename="stock-ecarts-inventaire"
            pdf={{
              title: "Stock — Écarts d'inventaire",
              subtitle: `Écarts et mouvements du ${period.fromInput} au ${period.toInput}`,
              organizationNom: organization.nom,
              devise: organization.devise,
              summary: [
                {
                  label: "Valorisation totale du stock (instantané)",
                  value: formatMoney(report.valorisationTotale, organization.devise),
                },
              ],
            }}
          />
        }
      />

      <Toolbar>
        {myShopIds.length > 1 && <ShopFilter consolidated={consolidated} />}
        <PeriodFilter fromInput={period.fromInput} toInput={period.toInput} />
      </Toolbar>

      <StatCard label="Valorisation totale du stock (instantané)" value={formatMoney(report.valorisationTotale, organization.devise)} />

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-foreground">Écarts d&apos;inventaire</h2>
        </div>
        <TablePanel>
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
        </TablePanel>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-foreground">Historique des mouvements</h2>
        <TablePanel>
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
        </TablePanel>
      </section>
    </Page>
  );
}
