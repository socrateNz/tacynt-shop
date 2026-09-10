import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { systemPrisma } from "@/lib/db/system-client";

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Actif",
  GRACE_PERIOD: "Période de grâce",
  SUSPENDED: "Suspendu",
};

export default async function PlatformOrganizationsPage() {
  const organizations = await systemPrisma.organization.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Organisations</h1>
        <p className="text-sm text-muted-foreground">
          {organizations.length} organisation{organizations.length > 1 ? "s" : ""} — plan et
          statut d&apos;abonnement gérés manuellement après encaissement hors ligne.
        </p>
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {organizations.map((org) => (
              <TableRow key={org.id}>
                <TableCell>
                  <Link
                    href={`/platform/${org.id}`}
                    className="text-sm text-primary underline-offset-4 hover:underline"
                  >
                    {org.nom}
                  </Link>
                </TableCell>
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
      </div>
    </div>
  );
}
