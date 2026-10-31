import Link from "next/link";
import { notFound, redirect } from "next/navigation";

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
import { systemPrisma } from "@/lib/db/system-client";
import { withTenantContext } from "@/lib/db/tenant-context";
import { formatMoney } from "@/lib/money";
import { hasCapability } from "@/lib/permissions";
import { getAssignedShopIds } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";
import { organizationHasModule } from "@/lib/tenant/modules";

import {
  cancelContract,
  confirmContract,
  recordDeposit,
  recordInstallmentPayment,
  terminateContract,
} from "../actions";

const STATUS_LABELS: Record<string, string> = {
  DEMANDE: "Demande",
  CONFIRMEE: "Confirmée",
  EN_COURS: "En cours",
  TERMINEE: "Terminée",
  ANNULEE: "Annulée",
};

const MODE_OPTIONS: { value: string; label: string }[] = [
  { value: "ESPECES", label: "Espèces" },
  { value: "MOBILE_MONEY", label: "Mobile Money" },
  { value: "CARTE", label: "Carte" },
  { value: "VIREMENT", label: "Virement" },
];

function ModeSelect({ name }: { name: string }) {
  return (
    <select name={name} required className="h-8 rounded-md border border-border bg-background px-2 text-sm">
      {MODE_OPTIONS.map((m) => (
        <option key={m.value} value={m.value}>
          {m.label}
        </option>
      ))}
    </select>
  );
}

export default async function RentalContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getTenantContext();
  const organization = await systemPrisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
  });

  if (
    !hasCapability(ctx.role, "location:manage") ||
    !organizationHasModule(organization.enabledModules, "location")
  ) {
    redirect("/dashboard");
  }

  const myShopIds = await getAssignedShopIds(ctx.organizationId, ctx.userId);

  const contract = await withTenantContext({ organizationId: ctx.organizationId }, (tx) =>
    tx.rentalContract.findUnique({
      where: { id },
      include: {
        rentalUnit: true,
        shop: true,
        installments: { orderBy: { moisIndex: "asc" } },
        payments: { orderBy: { createdAt: "desc" } },
      },
    }),
  );

  if (!contract || !myShopIds.includes(contract.shopId)) {
    notFound();
  }

  const now = new Date();
  const devise = organization.devise;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/rentals/contracts" className="text-sm text-muted-foreground hover:text-foreground">
          ← Retour aux locations
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground">{contract.numero}</h1>
            <Badge variant={contract.statut === "EN_COURS" ? "success" : contract.statut === "ANNULEE" ? "destructive" : "secondary"}>
              {STATUS_LABELS[contract.statut] ?? contract.statut}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {contract.rentalUnit.designation} — {contract.shop.nom}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {contract.statut === "DEMANDE" && (
            <>
              <form action={confirmContract}>
                <input type="hidden" name="contractId" value={contract.id} />
                <Button type="submit">Confirmer la demande</Button>
              </form>
              <form action={cancelContract}>
                <input type="hidden" name="contractId" value={contract.id} />
                <Button type="submit" variant="outline">
                  Refuser
                </Button>
              </form>
            </>
          )}
          {contract.statut === "CONFIRMEE" && (
            <form action={cancelContract}>
              <input type="hidden" name="contractId" value={contract.id} />
              <Button type="submit" variant="outline">
                Annuler
              </Button>
            </form>
          )}
          {contract.statut === "EN_COURS" && (
            <form action={terminateContract}>
              <input type="hidden" name="contractId" value={contract.id} />
              <Button type="submit" variant="outline">
                Résilier
              </Button>
            </form>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Client</p>
          <p className="text-foreground">{contract.nomClient}</p>
          <p className="text-sm text-muted-foreground">{contract.telephoneClient}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Durée</p>
          <p className="text-foreground">
            {contract.dureeMois} mois à partir du {contract.dateDebut.toLocaleDateString("fr-FR")}
          </p>
          <p className="num text-sm text-muted-foreground">
            {formatMoney(contract.montantMensuel, devise)} / mois
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Commission</p>
          <p className="num text-foreground">{formatMoney(contract.commissionMontant, devise)}</p>
          <Badge variant={contract.commissionPayee ? "success" : "secondary"}>
            {contract.commissionPayee ? "Réglée" : "Non réglée"}
          </Badge>
        </div>
      </div>

      {contract.statut === "CONFIRMEE" && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-4">
          <form action={recordDeposit} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="contractId" value={contract.id} />
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-foreground">
                Encaisser l&apos;acompte (1er mois
                {Number(contract.commissionMontant) > 0 ? " + commission" : ""})
              </p>
              <p className="num text-sm text-muted-foreground">
                {formatMoney(
                  Number(contract.montantMensuel) +
                    (contract.commissionPayee ? 0 : Number(contract.commissionMontant)),
                  devise,
                )}
              </p>
            </div>
            <ModeSelect name="mode" />
            <Button type="submit">Encaisser</Button>
          </form>
        </div>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-foreground">Échéancier</h2>
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mois</TableHead>
                <TableHead>Échéance</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contract.installments.map((i) => {
                const enRetard = i.statut === "DUE" && i.echeance < now;
                return (
                  <TableRow key={i.id}>
                    <TableCell className="text-foreground">Mois {i.moisIndex}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {i.echeance.toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell className="num text-right">{formatMoney(i.montantDu, devise)}</TableCell>
                    <TableCell>
                      {i.statut === "PAYEE" ? (
                        <Badge variant="success">Payée</Badge>
                      ) : enRetard ? (
                        <Badge variant="destructive">En retard</Badge>
                      ) : (
                        <Badge variant="secondary">À venir</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {i.statut === "DUE" && contract.statut === "EN_COURS" && i.moisIndex > 1 && (
                        <form action={recordInstallmentPayment} className="flex justify-end gap-2">
                          <input type="hidden" name="installmentId" value={i.id} />
                          <ModeSelect name="mode" />
                          <Button type="submit" size="sm">
                            Enregistrer
                          </Button>
                        </form>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {contract.installments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Échéancier généré après confirmation de la demande.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-foreground">Paiements encaissés</h2>
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Pour</TableHead>
                <TableHead className="text-right">Montant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contract.payments.map((p) => {
                const installment = contract.installments.find((i) => i.id === p.installmentId);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="text-muted-foreground">
                      {p.createdAt.toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {MODE_OPTIONS.find((m) => m.value === p.mode)?.label ?? p.mode}
                    </TableCell>
                    <TableCell className="text-foreground">
                      {installment ? `Mois ${installment.moisIndex}` : "Commission"}
                    </TableCell>
                    <TableCell className="num text-right">{formatMoney(p.montant, devise)}</TableCell>
                  </TableRow>
                );
              })}
              {contract.payments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Aucun paiement encaissé pour l&apos;instant.
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
