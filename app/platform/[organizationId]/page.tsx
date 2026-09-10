import { notFound } from "next/navigation";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { platformPrisma } from "@/lib/db/platform-client";
import { systemPrisma } from "@/lib/db/system-client";
import { formatMoney } from "@/lib/money";

import { ModulesForm, PlanStatusForm, RecordPaymentForm } from "./organization-forms";

export default async function PlatformOrganizationDetailPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;

  const organization = await systemPrisma.organization.findUnique({
    where: { id: organizationId },
  });
  if (!organization) {
    notFound();
  }

  const payments = await platformPrisma.platformPayment.findMany({
    where: { organizationId },
    include: { recordedByAdmin: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-xl font-semibold text-foreground">{organization.nom}</h1>
        <p className="text-sm text-muted-foreground">
          {organization.slug} — créée le {organization.createdAt.toLocaleDateString("fr-FR")}
        </p>
      </header>

      <PlanStatusForm
        organizationId={organization.id}
        plan={organization.plan}
        statut={organization.statut}
      />

      <ModulesForm
        organizationId={organization.id}
        enabledModules={
          Array.isArray(organization.enabledModules)
            ? organization.enabledModules.filter((m): m is string => typeof m === "string")
            : []
        }
      />

      <RecordPaymentForm organizationId={organization.id} devise={organization.devise} />

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-foreground">Historique des paiements constatés</h2>
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Période couverte</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Constaté par</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-muted-foreground">
                    {p.createdAt.toLocaleDateString("fr-FR")}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.periodeDebut.toLocaleDateString("fr-FR")} –{" "}
                    {p.periodeFin.toLocaleDateString("fr-FR")}
                  </TableCell>
                  <TableCell className="num text-right">
                    {formatMoney(p.montant, p.devise)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.recordedByAdmin.email}
                  </TableCell>
                </TableRow>
              ))}
              {payments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Aucun paiement constaté pour l&apos;instant.
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
