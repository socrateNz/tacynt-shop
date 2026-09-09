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
import { withTenantContext } from "@/lib/db/tenant-context";
import { hasCapability } from "@/lib/permissions";
import { getTenantContext } from "@/lib/tenant/context";

import { cancelTransfer } from "./actions";
import { ReceiveForm } from "./receive-form";
import { ShipForm } from "./ship-form";

const STATUS_LABELS: Record<string, string> = {
  DEMANDE: "Demandé",
  EXPEDIE: "Expédié (en transit)",
  RECU: "Reçu",
  ANNULE: "Annulé",
};

export default async function TransferDetailPage({
  params,
}: {
  params: Promise<{ transferId: string }>;
}) {
  const ctx = await getTenantContext();
  if (!hasCapability(ctx.role, "transfers:manage")) {
    redirect("/");
  }

  const { transferId } = await params;

  const transfer = await withTenantContext({ organizationId: ctx.organizationId }, (tx) =>
    tx.stockTransfer.findUniqueOrThrow({
      where: { id: transferId },
      include: {
        fromShop: true,
        toShop: true,
        lines: { include: { variant: { include: { product: true } } } },
      },
    }),
  );

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-xl font-semibold text-foreground">
          Transfert {transfer.numero} — {transfer.fromShop.nom} → {transfer.toShop.nom}
        </h1>
        <p className="text-sm text-muted-foreground">
          Statut : {STATUS_LABELS[transfer.statut] ?? transfer.statut}
        </p>
        <Link href="/transfers" className="text-sm text-primary underline-offset-4 hover:underline">
          ← Retour aux transferts
        </Link>
      </header>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produit</TableHead>
              <TableHead className="text-right">Demandé</TableHead>
              <TableHead className="text-right">Expédié</TableHead>
              <TableHead className="text-right">Reçu</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transfer.lines.map((l) => {
              const ecart =
                l.quantiteRecue !== null && l.quantiteExpediee !== null
                  ? Number(l.quantiteRecue) - Number(l.quantiteExpediee)
                  : null;
              return (
                <TableRow key={l.id}>
                  <TableCell className="text-foreground">{l.variant.product.designation}</TableCell>
                  <TableCell className="num text-right">{l.quantiteDemandee.toString()}</TableCell>
                  <TableCell className="num text-right">
                    {l.quantiteExpediee?.toString() ?? "—"}
                  </TableCell>
                  <TableCell
                    className={`num text-right ${ecart !== null && ecart !== 0 ? "text-destructive" : ""}`}
                  >
                    {l.quantiteRecue?.toString() ?? "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {transfer.statut === "DEMANDE" && (
        <>
          <ShipForm
            transferId={transfer.id}
            lines={transfer.lines.map((l) => ({
              lineId: l.id,
              designation: l.variant.product.designation,
              quantiteDemandee: Number(l.quantiteDemandee),
            }))}
          />
          <form action={cancelTransfer}>
            <input type="hidden" name="transferId" value={transfer.id} />
            <Button type="submit" variant="ghost">
              Annuler la demande
            </Button>
          </form>
        </>
      )}

      {transfer.statut === "EXPEDIE" && (
        <ReceiveForm
          transferId={transfer.id}
          lines={transfer.lines.map((l) => ({
            lineId: l.id,
            designation: l.variant.product.designation,
            quantiteExpediee: Number(l.quantiteExpediee ?? 0),
          }))}
        />
      )}
    </div>
  );
}
