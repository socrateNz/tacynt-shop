import Link from "next/link";
import { Plus } from "lucide-react";

import { Page, PageHeader, TablePanel } from "@/components/admin/page";
import { Badge } from "@/components/ui/badge";
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

import { CopyLinkButton } from "./copy-link-button";
import { OrganizationDetailDialog } from "./organization-detail-dialog";

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Actif",
  GRACE_PERIOD: "Période de grâce",
  SUSPENDED: "Suspendu",
};

// Même défaut que lib/tenant/resolve.ts (ROOT_DOMAIN) — http en local
// (localhost n'a pas de certificat), https partout ailleurs.
const ROOT_DOMAIN = process.env.APP_ROOT_DOMAIN ?? "localhost:3000";
const PROTOCOL = ROOT_DOMAIN.startsWith("localhost") ? "http" : "https";

function shopUrl(slug: string): string {
  return `${PROTOCOL}://${slug}.${ROOT_DOMAIN}`;
}

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

  const owners = organizationIds.length
    ? await systemPrisma.user.findMany({
        where: { organizationId: { in: organizationIds }, role: "PROPRIETAIRE" },
        select: { organizationId: true, email: true },
      })
    : [];
  const ownerEmailByOrg = new Map(owners.map((u) => [u.organizationId, u.email]));

  return (
    <Page>
      <PageHeader
        title="Organisations"
        description={<>{organizations.length} organisation{organizations.length > 1 ? "s" : ""} — plan et statut d&apos;abonnement gérés manuellement après encaissement hors ligne.</>}
        actions={
          <>
            <Button nativeButton={false} render={<Link href="/platform/new" />}>
              <Plus />
              Nouvelle organisation
            </Button>
          </>
        }
      />

      <TablePanel>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Organisation</TableHead>
              <TableHead className="hidden md:table-cell">Plan</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="hidden lg:table-cell">Créée le</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {organizations.map((org) => (
              <TableRow key={org.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">{org.nom}</span>
                    <span className="text-xs text-muted-foreground">{org.slug}</span>
                  </div>
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">{org.plan}</TableCell>
                <TableCell>
                  <Badge
                    variant={org.statut === "SUSPENDED" ? "destructive" : org.statut === "GRACE_PERIOD" ? "warning" : "success"}
                  >
                    {STATUS_LABELS[org.statut] ?? org.statut}
                  </Badge>
                </TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">
                  {org.createdAt.toLocaleDateString("fr-FR")}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                  <CopyLinkButton url={shopUrl(org.slug)} />
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
                    pays={org.pays}
                    payments={(paymentsByOrg.get(org.id) ?? []).map((p) => ({
                      id: p.id,
                      createdAtLabel: p.createdAt.toLocaleDateString("fr-FR"),
                      periodeLabel: `${p.periodeDebut.toLocaleDateString("fr-FR")} – ${p.periodeFin.toLocaleDateString("fr-FR")}`,
                      montantLabel: formatMoney(p.montant, p.devise),
                      recordedByEmail: p.recordedByAdmin.email,
                    }))}
                    ownerEmail={ownerEmailByOrg.get(org.id) ?? null}
                  />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {organizations.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Aucune organisation pour l&apos;instant.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TablePanel>
    </Page>
  );
}
