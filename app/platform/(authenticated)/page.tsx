import Link from "next/link";

import { Button } from "@/components/ui/button";
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

import { OrganizationDetailDialog } from "./organization-detail-dialog";

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Actif",
  GRACE_PERIOD: "Période de grâce",
  SUSPENDED: "Suspendu",
};

export default async function PlatformOrganizationsPage() {
  const organizations = await systemPrisma.organization.findMany({
    orderBy: { createdAt: "desc" },
  });

  const organizationIds = organizations.map((o) => o.id);
  const payments = organizationIds.length
    ? await platformPrisma.platformPayment.findMany({
        where: { organizationId: { in: organizationIds } },
        include: { recordedByAdmin: true },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const paymentsByOrg = new Map<string, typeof payments>();
  for (const p of payments) {
    const list = paymentsByOrg.get(p.organizationId) ?? [];
    list.push(p);
    paymentsByOrg.set(p.organizationId, list);
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Organisations</h1>
          <p className="text-sm text-muted-foreground">
            {organizations.length} organisation{organizations.length > 1 ? "s" : ""} — plan et
            statut d&apos;abonnement gérés manuellement après encaissement hors ligne.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/platform/new" />}>
          Nouvelle organisation
        </Button>
      </header>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Sous-domaine</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Créée le</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {organizations.map((org) => (
              <TableRow key={org.id}>
                <TableCell className="text-sm text-foreground">{org.nom}</TableCell>
                <TableCell className="text-muted-foreground">{org.slug}</TableCell>
                <TableCell className="text-muted-foreground">{org.plan}</TableCell>
                <TableCell
                  className={
                    org.statut === "SUSPENDED" ? "text-destructive" : "text-muted-foreground"
                  }
                >
                  {STATUS_LABELS[org.statut] ?? org.statut}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {org.createdAt.toLocaleDateString("fr-FR")}
                </TableCell>
                <TableCell className="text-right">
                  <OrganizationDetailDialog
                    organizationId={org.id}
                    nom={org.nom}
                    slug={org.slug}
                    createdAtLabel={org.createdAt.toLocaleDateString("fr-FR")}
                    plan={org.plan}
                    statut={org.statut}
                    enabledModules={
                      Array.isArray(org.enabledModules)
                        ? org.enabledModules.filter((m): m is string => typeof m === "string")
                        : []
                    }
                    devise={org.devise}
                    payments={(paymentsByOrg.get(org.id) ?? []).map((p) => ({
                      id: p.id,
                      createdAtLabel: p.createdAt.toLocaleDateString("fr-FR"),
                      periodeLabel: `${p.periodeDebut.toLocaleDateString("fr-FR")} – ${p.periodeFin.toLocaleDateString("fr-FR")}`,
                      montantLabel: formatMoney(p.montant, p.devise),
                      recordedByEmail: p.recordedByAdmin.email,
                    }))}
                  />
                </TableCell>
              </TableRow>
            ))}
            {organizations.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Aucune organisation pour l&apos;instant.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
