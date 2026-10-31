import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { withTenantContext } from "@/lib/db/tenant-context";
import { formatMoney } from "@/lib/money";
import { getStorefrontOrganization } from "@/lib/storefront/context";

const STATUS_LABELS: Record<string, string> = {
  DEMANDE: "En attente de confirmation",
  CONFIRMEE: "Confirmée",
  EN_COURS: "En cours",
  TERMINEE: "Terminée",
  ANNULEE: "Annulée",
};

export default async function RentalMerciPage({
  params,
}: {
  params: Promise<{ contractId: string }>;
}) {
  const organization = await getStorefrontOrganization("location");
  if (!organization) {
    notFound();
  }

  const { contractId } = await params;

  // Scopé à l'organisation résolue par host — même principe que
  // merci/[orderId] : un id d'une autre organisation ne matche simplement
  // aucune ligne (isolation héritée de la RLS).
  const contract = await withTenantContext({ organizationId: organization.id }, (tx) =>
    tx.rentalContract.findUnique({
      where: { id: contractId },
      include: { rentalUnit: true },
    }),
  );

  if (!contract) {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/10 p-4">
        <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-success" />
        <div>
          <h1 className="text-xl font-semibold text-success">Demande envoyée avec succès</h1>
          <p className="text-sm text-success/80">
            Numéro {contract.numero} — {STATUS_LABELS[contract.statut] ?? contract.statut}
          </p>
        </div>
      </header>

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-foreground">{contract.rentalUnit.designation}</p>
        <p className="num text-sm text-muted-foreground">
          {formatMoney(contract.montantMensuel, organization.devise)} / mois — {contract.dureeMois} mois à
          partir du {contract.dateDebut.toLocaleDateString("fr-FR")}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Vous serez contacté(e) au {contract.telephoneClient} pour confirmer la réservation et convenir
          du règlement de l&apos;acompte.
        </p>
      </div>

      <Link href="/locations" className="text-sm text-primary underline-offset-4 hover:underline">
        ← Retour aux logements
      </Link>
    </div>
  );
}
