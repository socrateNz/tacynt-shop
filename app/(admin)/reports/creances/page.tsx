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
import { getCreancesReport } from "@/lib/reports/creances";
import { getTenantContext } from "@/lib/tenant/context";

import { ExportButtons } from "../export-buttons";

export default async function CreancesReportPage() {
  const ctx = await getTenantContext();
  if (!hasCapability(ctx.role, "reports:read")) {
    redirect("/");
  }

  const organization = await systemPrisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
  });

  const report = await withTenantContext({ organizationId: ctx.organizationId }, (tx) =>
    getCreancesReport(tx, ctx.organizationId),
  );

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Créances</h1>
        <p className="text-sm text-muted-foreground">
          Balance âgée des ardoises clients — instantané au moment présent.
        </p>
      </header>

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-medium text-muted-foreground uppercase">Total dû</p>
        <p className="num text-2xl font-semibold text-foreground">
          {formatMoney(report.totalDu, organization.devise)}
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-foreground">Par tranche d&apos;âge</h2>
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tranche</TableHead>
                <TableHead className="text-right">Montant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.parTranche.map((r) => (
                <TableRow key={r.tranche}>
                  <TableCell className="text-foreground">{r.tranche}</TableCell>
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
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground">Par client</h2>
          <ExportButtons
            rows={report.parClient}
            columns={[
              { key: "nom", label: "Client" },
              { key: "solde", label: "Solde dû" },
              { key: "j0_30", label: "0-30j" },
              { key: "j31_60", label: "31-60j" },
              { key: "j61_90", label: "61-90j" },
              { key: "j90Plus", label: "90j+" },
            ]}
            filename="creances-par-client"
          />
        </div>
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead className="text-right">Solde dû</TableHead>
                <TableHead className="text-right">0-30j</TableHead>
                <TableHead className="text-right">31-60j</TableHead>
                <TableHead className="text-right">61-90j</TableHead>
                <TableHead className="text-right">90j+</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.parClient.map((r) => (
                <TableRow key={r.customerId}>
                  <TableCell className="text-foreground">{r.nom}</TableCell>
                  <TableCell className="num text-right">
                    {formatMoney(r.solde, organization.devise)}
                  </TableCell>
                  <TableCell className="num text-right">
                    {formatMoney(r.j0_30, organization.devise)}
                  </TableCell>
                  <TableCell className="num text-right">
                    {formatMoney(r.j31_60, organization.devise)}
                  </TableCell>
                  <TableCell className="num text-right">
                    {formatMoney(r.j61_90, organization.devise)}
                  </TableCell>
                  <TableCell
                    className={`num text-right ${r.j90Plus > 0 ? "text-destructive" : ""}`}
                  >
                    {formatMoney(r.j90Plus, organization.devise)}
                  </TableCell>
                </TableRow>
              ))}
              {report.parClient.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Aucune créance en cours.
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
