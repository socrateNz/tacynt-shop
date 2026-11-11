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
import { resolveAccountingMapping } from "@/lib/reports/accounting-mapping";
import { getAccountingJournal } from "@/lib/reports/accounting";
import { parsePeriod } from "@/lib/reports/period";
import { getActiveShopId, getAssignedShopIds } from "@/lib/tenant/active-shop";
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
  // "Toutes les boutiques" ne consolide plus que les boutiques auxquelles CET
  // utilisateur est affecté, jamais toutes celles de l'organisation : sans
  // ça, un Gérant/Comptable affecté à une seule boutique verrait les
  // chiffres de boutiques dont il n'a jamais eu la charge en tapant
  // simplement ?shop=all dans l'URL (rien ne validait ce paramètre).
  const myShopIds = await getAssignedShopIds(ctx.organizationId, ctx.userId);
  const activeShopId = await getActiveShopId(ctx.organizationId, ctx.userId);
  const consolidated = sp.shop === "all" && myShopIds.length > 1;
  const shopId = consolidated ? myShopIds : activeShopId;

  const mapping = resolveAccountingMapping(parseOrgSettings(organization.settings));

  const journal = await withTenantContext(
    typeof shopId === "string"
      ? { organizationId: ctx.organizationId, shopId }
      : { organizationId: ctx.organizationId },
    (tx) => getAccountingJournal(tx, shopId, period.from, period.to, mapping),
  );

  const totalDebit = journal.reduce((sum, l) => sum + l.montant, 0);

  return (
    <Page>
      <PageHeader
        back={{ href: "/reports", label: "Rapports" }}
        title="Comptabilité"
        description={<>Du {period.fromInput} au {period.toInput} — export uniquement, aucune intégration comptable en direct.</>}
        actions={
          <ExportButtons
            rows={journal}
            columns={[
              { key: "date", label: "Date" },
              { key: "piece", label: "Pièce" },
              { key: "compteDebit", label: "Compte débit" },
              { key: "compteCredit", label: "Compte crédit" },
              { key: "montant", label: "Montant", format: "money" },
              { key: "libelle", label: "Libellé" },
            ]}
            filename="journal-comptable"
            pdf={{
              title: "Comptabilité — Journal comptable",
              subtitle: `Du ${period.fromInput} au ${period.toInput}`,
              organizationNom: organization.nom,
              devise: organization.devise,
              summary: [
                {
                  label: "Total du journal (débit = crédit)",
                  value: formatMoney(totalDebit, organization.devise),
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

      <StatCard label="Total du journal (débit = crédit)" value={formatMoney(totalDebit, organization.devise)} />


      <section className="flex flex-col gap-3">
        <TablePanel>
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
        </TablePanel>
      </section>
    </Page>
  );
}
