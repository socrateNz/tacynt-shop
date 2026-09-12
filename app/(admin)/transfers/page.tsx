import { Eye } from "lucide-react";
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

import { TransferForm } from "./transfer-form";

const STATUS_LABELS: Record<string, string> = {
  DEMANDE: "Demandé",
  EXPEDIE: "Expédié (en transit)",
  RECU: "Reçu",
  ANNULE: "Annulé",
};

export default async function TransfersPage() {
  const ctx = await getTenantContext();
  if (!hasCapability(ctx.role, "transfers:manage")) {
    redirect("/");
  }

  const { transfers, shops, variants } = await withTenantContext(
    { organizationId: ctx.organizationId },
    async (tx) => {
      const transfers = await tx.stockTransfer.findMany({
        orderBy: { createdAt: "desc" },
        include: { fromShop: true, toShop: true },
        take: 50,
      });
      const shops = await tx.shop.findMany({ where: { actif: true }, orderBy: { nom: "asc" } });
      const variants = await tx.productVariant.findMany({
        where: { actif: true, product: { suiviStock: true } },
        include: { product: true },
        orderBy: { product: { designation: "asc" } },
      });
      return { transfers, shops, variants };
    },
  );

  const enTransit = transfers.filter((t) => t.statut === "EXPEDIE");

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Transferts inter-boutiques</h1>
        <p className="text-sm text-muted-foreground">
          Demande → expédition (sortie du stock émetteur) → réception (entrée dans le stock
          destinataire, écart éventuel constaté).
        </p>
      </header>

      {enTransit.length > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-4">
          <p className="text-sm font-medium text-foreground">
            Stock en transit ({enTransit.length})
          </p>
          <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
            {enTransit.map((t) => (
              <li key={t.id}>
                <Link href={`/transfers/${t.id}`} className="underline-offset-4 hover:underline">
                  {t.numero}
                </Link>{" "}
                — {t.fromShop.nom} → {t.toShop.nom}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Numéro</TableHead>
              <TableHead>De</TableHead>
              <TableHead>Vers</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transfers.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <Link
                    href={`/transfers/${t.id}`}
                    className="text-foreground underline-offset-4 hover:underline"
                  >
                    {t.numero}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{t.fromShop.nom}</TableCell>
                <TableCell className="text-muted-foreground">{t.toShop.nom}</TableCell>
                <TableCell className="text-muted-foreground">
                  {STATUS_LABELS[t.statut] ?? t.statut}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {t.createdAt.toLocaleDateString("fr-FR")}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    nativeButton={false}
                    render={<Link href={`/transfers/${t.id}`} />}
                  >
                    <Eye className="size-3.5" />
                    <span className="sr-only">Voir</span>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {transfers.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Aucun transfert pour l&apos;instant.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <TransferForm
        shops={shops.map((s) => ({ id: s.id, nom: s.nom }))}
        variants={variants.map((v) => ({ id: v.id, label: v.product.designation }))}
      />
    </div>
  );
}
