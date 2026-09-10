import Link from "next/link";
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
import { getTenantContext } from "@/lib/tenant/context";
import { organizationHasModule } from "@/lib/tenant/modules";

const STATUS_LABELS: Record<string, string> = {
  EN_ATTENTE: "En attente",
  CONFIRMEE: "Confirmée",
  PRETE: "Prête",
  RECUPEREE: "Récupérée",
  ANNULEE: "Annulée",
};

export default async function OnlineOrdersPage() {
  const ctx = await getTenantContext();
  const organization = await systemPrisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
  });

  // Deux axes distincts (Phase 4, décision #2) : la capacité ET le module.
  if (
    !hasCapability(ctx.role, "ecommerce:manage") ||
    !organizationHasModule(organization.enabledModules, "ecommerce")
  ) {
    redirect("/");
  }

  const orders = await withTenantContext({ organizationId: ctx.organizationId }, (tx) =>
    tx.onlineOrder.findMany({
      orderBy: { createdAt: "desc" },
      include: { shop: true },
      take: 100,
    }),
  );

  const enAttente = orders.filter((o) => o.statut === "EN_ATTENTE" || o.statut === "CONFIRMEE");

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Commandes en ligne</h1>
        <p className="text-sm text-muted-foreground">
          Paiement à la réception — l&apos;encaissement en boutique convertit la commande en
          vente normale.
        </p>
      </header>

      {enAttente.length > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-4">
          <p className="text-sm font-medium text-foreground">
            À traiter ({enAttente.length})
          </p>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Numéro</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Boutique</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((o) => (
              <TableRow key={o.id}>
                <TableCell>
                  <Link
                    href={`/online-orders/${o.id}`}
                    className="text-foreground underline-offset-4 hover:underline"
                  >
                    {o.numero}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{o.nomClient}</TableCell>
                <TableCell className="text-muted-foreground">{o.shop.nom}</TableCell>
                <TableCell className="text-muted-foreground">
                  {STATUS_LABELS[o.statut] ?? o.statut}
                </TableCell>
                <TableCell className="num text-right">
                  {formatMoney(o.totalTtc, organization.devise)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {o.createdAt.toLocaleDateString("fr-FR")}
                </TableCell>
              </TableRow>
            ))}
            {orders.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Aucune commande en ligne pour l&apos;instant.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
