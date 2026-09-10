import Link from "next/link";
import { redirect } from "next/navigation";

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
import { getTenantContext } from "@/lib/tenant/context";
import { organizationHasModule } from "@/lib/tenant/modules";

import { cancelOrder, confirmOrder } from "../actions";
import { FulfillForm } from "./fulfill-form";

const STATUS_LABELS: Record<string, string> = {
  EN_ATTENTE: "En attente",
  CONFIRMEE: "Confirmée",
  PRETE: "Prête",
  RECUPEREE: "Récupérée",
  ANNULEE: "Annulée",
};

const MODE_LABELS: Record<string, string> = {
  RETRAIT_BOUTIQUE: "Retrait en boutique",
  LIVRAISON: "Livraison",
};

export default async function OnlineOrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const ctx = await getTenantContext();
  const organization = await systemPrisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
  });

  if (
    !hasCapability(ctx.role, "ecommerce:manage") ||
    !organizationHasModule(organization.enabledModules, "ecommerce")
  ) {
    redirect("/");
  }

  const { orderId } = await params;

  const order = await withTenantContext({ organizationId: ctx.organizationId }, (tx) =>
    tx.onlineOrder.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        shop: true,
        lines: { include: { variant: { include: { product: true } } } },
      },
    }),
  );

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Commande {order.numero}</h1>
        <p className="text-sm text-muted-foreground">
          Statut : {STATUS_LABELS[order.statut] ?? order.statut} — {order.shop.nom}
        </p>
        <Link
          href="/online-orders"
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          ← Retour aux commandes
        </Link>
      </header>

      <section className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-card p-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase">Client</p>
          <p className="text-sm text-foreground">{order.nomClient}</p>
          <p className="text-sm text-muted-foreground">{order.telephoneClient}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase">Retrait</p>
          <p className="text-sm text-foreground">{MODE_LABELS[order.modeRetrait] ?? order.modeRetrait}</p>
          {order.adresseLivraison && (
            <p className="text-sm text-muted-foreground">{order.adresseLivraison}</p>
          )}
        </div>
        {order.notes && (
          <div className="col-span-2">
            <p className="text-xs font-medium text-muted-foreground uppercase">Notes</p>
            <p className="text-sm text-muted-foreground">{order.notes}</p>
          </div>
        )}
      </section>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produit</TableHead>
              <TableHead className="text-right">Quantité</TableHead>
              <TableHead className="text-right">Prix unitaire</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.lines.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="text-foreground">{l.variant.product.designation}</TableCell>
                <TableCell className="num text-right">{l.quantite.toString()}</TableCell>
                <TableCell className="num text-right">
                  {formatMoney(l.prixUnitaire, organization.devise)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end">
        <p className="num text-lg font-semibold text-foreground">
          Total : {formatMoney(order.totalTtc, organization.devise)}
        </p>
      </div>

      {order.statut !== "RECUPEREE" && order.statut !== "ANNULEE" && (
        <>
          <div className="flex gap-2">
            {order.statut === "EN_ATTENTE" && (
              <form action={confirmOrder}>
                <input type="hidden" name="orderId" value={order.id} />
                <Button type="submit">Confirmer la commande</Button>
              </form>
            )}
            <form action={cancelOrder}>
              <input type="hidden" name="orderId" value={order.id} />
              <Button type="submit" variant="ghost">
                Annuler
              </Button>
            </form>
          </div>

          <FulfillForm orderId={order.id} totalTtc={Number(order.totalTtc)} />
        </>
      )}

      {order.statut === "RECUPEREE" && order.saleId && (
        <p className="text-sm text-muted-foreground">
          Encaissée — vente correspondante visible dans{" "}
          <Link href="/sales" className="text-primary underline-offset-4 hover:underline">
            Ventes
          </Link>
        </p>
      )}
    </div>
  );
}
