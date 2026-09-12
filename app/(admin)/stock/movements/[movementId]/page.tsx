import Link from "next/link";
import { redirect } from "next/navigation";

import { systemPrisma } from "@/lib/db/system-client";
import { withTenantContext } from "@/lib/db/tenant-context";
import { formatMoney } from "@/lib/money";
import { hasCapability } from "@/lib/permissions";
import { getTenantContext } from "@/lib/tenant/context";

const TYPE_LABELS: Record<string, string> = {
  RECEPTION: "Réception",
  VENTE: "Vente",
  RETOUR_CLIENT: "Retour client",
  RETOUR_FOURNISSEUR: "Retour fournisseur",
  TRANSFERT_SORTANT: "Transfert sortant",
  TRANSFERT_ENTRANT: "Transfert entrant",
  AJUSTEMENT: "Ajustement",
  CASSE_PERTE_VOL: "Casse / perte / vol",
  CONSOMMATION_INTERNE: "Consommation interne",
};

export default async function StockMovementDetailPage({
  params,
}: {
  params: Promise<{ movementId: string }>;
}) {
  const ctx = await getTenantContext();
  if (!hasCapability(ctx.role, "stock:read")) {
    redirect("/");
  }

  const { movementId } = await params;
  const organization = await systemPrisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
  });

  const movement = await withTenantContext({ organizationId: ctx.organizationId }, (tx) =>
    tx.stockMovement.findUniqueOrThrow({
      where: { id: movementId },
      include: { variant: { include: { product: true } }, shop: true, lot: true },
    }),
  );

  const user = movement.userId
    ? await systemPrisma.user.findUnique({ where: { id: movement.userId } })
    : null;

  const rows: { label: string; value: string }[] = [
    { label: "Date", value: movement.createdAt.toLocaleString("fr-FR") },
    { label: "Boutique", value: movement.shop.nom },
    { label: "Produit", value: movement.variant.product.designation },
    { label: "Type", value: TYPE_LABELS[movement.type] ?? movement.type },
    { label: "Quantité", value: movement.quantite.toString() },
    {
      label: "Coût unitaire",
      value: formatMoney(movement.coutUnitaire, organization.devise),
    },
  ];
  if (movement.lot) rows.push({ label: "Lot", value: movement.lot.numero });
  if (movement.motif) rows.push({ label: "Motif", value: movement.motif });
  if (user) rows.push({ label: "Utilisateur", value: user.email });
  if (movement.documentType) {
    rows.push({
      label: "Document source",
      value: `${movement.documentType}${movement.documentId ? ` (${movement.documentId})` : ""}`,
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <Link
          href="/stock/movements"
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          ← Retour au stock
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-foreground">Mouvement de stock</h1>
      </header>

      <div className="max-w-lg rounded-xl border border-border bg-card p-6">
        <dl className="flex flex-col gap-3">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-4 text-sm">
              <dt className="text-muted-foreground">{r.label}</dt>
              <dd className="text-right text-foreground">{r.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
