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
import { getVentesReport } from "@/lib/reports/ventes";
import { getActiveShopId, getAssignedShopIds } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";

import { ExportButtons } from "../export-buttons";
import { PeriodFilter } from "../period-filter";
import { ShopFilter } from "../shop-filter";

export default async function VentesReportPage({
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
    (tx) => getVentesReport(tx, shopId, period.from, period.to),
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Ventes</h1>
          <p className="text-sm text-muted-foreground">
            Du {period.fromInput} au {period.toInput}
          </p>
        </div>
        <div className="no-print flex flex-wrap items-center gap-2">
          {myShopIds.length > 1 && <ShopFilter consolidated={consolidated} />}
          <PeriodFilter fromInput={period.fromInput} toInput={period.toInput} />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase">Chiffre d&apos;affaires</p>
          <p className="num text-2xl font-semibold text-foreground">
            {formatMoney(report.totalCa, organization.devise)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase">Tickets</p>
          <p className="num text-2xl font-semibold text-foreground">{report.totalTickets}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase">Panier moyen</p>
          <p className="num text-2xl font-semibold text-foreground">
            {formatMoney(report.panierMoyen, organization.devise)}
          </p>
        </div>
      </div>

      <ExportButtons
        rows={report.parJour}
        columns={[
          { key: "date", label: "Date" },
          { key: "ca", label: "CA", format: "money" },
          { key: "tickets", label: "Tickets", format: "number" },
        ]}
        filename="ventes-par-jour"
        pdf={{
          title: "Ventes — Par jour",
          subtitle: `Du ${period.fromInput} au ${period.toInput}`,
          organizationNom: organization.nom,
          devise: organization.devise,
          summary: [
            { label: "Chiffre d'affaires", value: formatMoney(report.totalCa, organization.devise) },
            { label: "Tickets", value: String(report.totalTickets) },
            { label: "Panier moyen", value: formatMoney(report.panierMoyen, organization.devise) },
          ],
        }}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-foreground">Par jour</h2>
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">CA</TableHead>
                <TableHead className="text-right">Tickets</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.parJour.map((r) => (
                <TableRow key={r.date}>
                  <TableCell className="text-foreground">{r.date}</TableCell>
                  <TableCell className="num text-right">{formatMoney(r.ca, organization.devise)}</TableCell>
                  <TableCell className="num text-right">{r.tickets}</TableCell>
                </TableRow>
              ))}
              {report.parJour.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    Aucune vente sur la période.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-foreground">Par vendeur</h2>
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendeur</TableHead>
                <TableHead className="text-right">CA</TableHead>
                <TableHead className="text-right">Tickets</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.parVendeur.map((r) => (
                <TableRow key={r.userId}>
                  <TableCell className="text-foreground">{r.nom}</TableCell>
                  <TableCell className="num text-right">{formatMoney(r.ca, organization.devise)}</TableCell>
                  <TableCell className="num text-right">{r.tickets}</TableCell>
                </TableRow>
              ))}
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.parCategorie.map((r) => (
                <TableRow key={r.categorie}>
                  <TableCell className="text-foreground">{r.categorie}</TableCell>
                  <TableCell className="num text-right">{formatMoney(r.ca, organization.devise)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-foreground">Par mode de paiement</h2>
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mode</TableHead>
                <TableHead className="text-right">Montant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.parModePaiement.map((r) => (
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
    </div>
  );
}
