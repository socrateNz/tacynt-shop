import { platformPrisma } from "@/lib/db/platform-client";
import { formatMoney } from "@/lib/money";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const MONTH_LABELS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

// Jamais additionner des montants de devises différentes entre eux (une
// organisation choisit librement sa devise, lib/tenant/currency.ts) — chaque
// agrégat reste une Map devise -> total, affichée comme une liste de
// montants par devise plutôt qu'un faux total unique.
function formatAmounts(byDevise: Map<string, number>): string {
  return [...byDevise.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([devise, montant]) => formatMoney(montant, devise))
    .join(" + ");
}

function addAmount(byDevise: Map<string, number>, devise: string, montant: number): void {
  byDevise.set(devise, (byDevise.get(devise) ?? 0) + montant);
}

// Chiffre d'affaires de la plateforme (abonnements payés par les
// organisations) — distinct du chiffre d'affaires de CHAQUE organisation
// (ses propres ventes, visible dans ses propres rapports). Les paiements
// constatés ici (platform_payments) sont enregistrés manuellement par un
// admin après encaissement hors ligne (voir organization-detail-dialog.tsx,
// "Constater un paiement") — ce total reflète ce qui a été noté, pas une
// facturation automatisée.
export default async function PlatformRevenuePage() {
  const payments = await platformPrisma.platformPayment.findMany({
    include: { organization: { select: { id: true, nom: true } } },
    orderBy: { createdAt: "desc" },
  });

  const totalByDevise = new Map<string, number>();
  const byMonth = new Map<string, Map<string, number>>();
  const byOrg = new Map<string, { id: string; nom: string; amounts: Map<string, number> }>();

  for (const p of payments) {
    const montant = Number(p.montant);
    addAmount(totalByDevise, p.devise, montant);

    const monthKey = `${p.createdAt.getFullYear()}-${String(p.createdAt.getMonth() + 1).padStart(2, "0")}`;
    const monthAmounts = byMonth.get(monthKey) ?? new Map<string, number>();
    addAmount(monthAmounts, p.devise, montant);
    byMonth.set(monthKey, monthAmounts);

    const org = byOrg.get(p.organizationId) ?? {
      id: p.organizationId,
      nom: p.organization.nom,
      amounts: new Map<string, number>(),
    };
    addAmount(org.amounts, p.devise, montant);
    byOrg.set(p.organizationId, org);
  }

  const months = [...byMonth.entries()].sort(([a], [b]) => b.localeCompare(a));
  const orgs = [...byOrg.values()].sort((a, b) => {
    const totalA = [...a.amounts.values()].reduce((s, n) => s + n, 0);
    const totalB = [...b.amounts.values()].reduce((s, n) => s + n, 0);
    return totalB - totalA;
  });

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Chiffre d&apos;affaires</h1>
        <p className="text-sm text-muted-foreground">
          Paiements d&apos;abonnement constatés manuellement ({payments.length} au total) — voir
          &quot;Constater un paiement&quot; sur la fiche de chaque organisation.
        </p>
      </header>

      {totalByDevise.size === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun paiement constaté pour l&apos;instant.</p>
      ) : (
        <div className="flex flex-wrap gap-4">
          {[...totalByDevise.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([devise, montant]) => (
              <div key={devise} className="rounded-xl border border-border bg-card p-6">
                <p className="text-xs font-medium text-muted-foreground uppercase">
                  Total — {devise}
                </p>
                <p className="num mt-1 text-2xl font-semibold text-foreground">
                  {formatMoney(montant, devise)}
                </p>
              </div>
            ))}
        </div>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-foreground">Par mois</h2>
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mois</TableHead>
                <TableHead className="text-right">Montant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {months.map(([key, amounts]) => {
                const [year, month] = key.split("-");
                return (
                  <TableRow key={key}>
                    <TableCell className="text-foreground">
                      {MONTH_LABELS[Number(month) - 1]} {year}
                    </TableCell>
                    <TableCell className="num text-right">{formatAmounts(amounts)}</TableCell>
                  </TableRow>
                );
              })}
              {months.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground">
                    Aucun paiement pour l&apos;instant.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-foreground">Par organisation</h2>
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organisation</TableHead>
                <TableHead className="text-right">Total versé</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgs.map((org) => (
                <TableRow key={org.id}>
                  <TableCell className="text-foreground">{org.nom}</TableCell>
                  <TableCell className="num text-right">{formatAmounts(org.amounts)}</TableCell>
                </TableRow>
              ))}
              {orgs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground">
                    Aucun paiement pour l&apos;instant.
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
