import { Plus } from "lucide-react";
import { redirect } from "next/navigation";

import { Page, PageHeader, TablePanel } from "@/components/admin/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { getAssignedShopIds } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";

import { TransferDialog } from "./transfer-dialog";
import { TransferForm } from "./transfer-form";

const STATUS_LABELS: Record<string, string> = {
  DEMANDE: "Demandé",
  EXPEDIE: "Expédié (en transit)",
  RECU: "Reçu",
  ANNULE: "Annulé",
};

const STATUS_TONES: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  DEMANDE: "secondary",
  EXPEDIE: "warning",
  RECU: "success",
  ANNULE: "destructive",
};

export default async function TransfersPage() {
  const ctx = await getTenantContext();
  if (!hasCapability(ctx.role, "transfers:manage")) {
    redirect("/dashboard");
  }

  const myShopIds = await getAssignedShopIds(ctx.organizationId, ctx.userId);

  const { transfers, shops, variants } = await withTenantContext(
    { organizationId: ctx.organizationId },
    async (tx) => {
      // Seulement les transferts qui touchent une boutique affectée à cet
      // utilisateur (émettrice ou destinataire) — jamais tous ceux de
      // l'organisation, même si le formulaire ci-dessous doit pouvoir nommer
      // n'importe quelle boutique comme contrepartie (voir transfer-form.tsx).
      const transfers = await tx.stockTransfer.findMany({
        where: { OR: [{ fromShopId: { in: myShopIds } }, { toShopId: { in: myShopIds } }] },
        orderBy: { createdAt: "desc" },
        include: {
          fromShop: true,
          toShop: true,
          lines: { include: { variant: { include: { product: true } } } },
        },
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
    <Page>
      <PageHeader
        title="Transferts inter-boutiques"
        meta={enTransit.length > 0 ? <Badge variant="warning">{enTransit.length} en transit</Badge> : undefined}
        description="Demande → expédition (sortie du stock émetteur) → réception (entrée dans le stock destinataire, écart éventuel constaté)."
        actions={
          <>
            <Dialog>
              <DialogTrigger render={<Button />}>
                <Plus />
                Nouveau transfert
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Nouvelle demande de transfert</DialogTitle>
                </DialogHeader>
                <TransferForm
                  shops={shops.map((s) => ({ id: s.id, nom: s.nom }))}
                  variants={variants.map((v) => ({ id: v.id, label: v.product.designation }))}
                />
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <TablePanel>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Transfert</TableHead>
              <TableHead>De</TableHead>
              <TableHead>Vers</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transfers.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="num font-medium text-foreground">{t.numero}</span>
                    <span className="text-xs text-muted-foreground">{t.createdAt.toLocaleDateString("fr-FR")}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{t.fromShop.nom}</TableCell>
                <TableCell className="text-muted-foreground">{t.toShop.nom}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_TONES[t.statut] ?? "secondary"}>{STATUS_LABELS[t.statut] ?? t.statut}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <TransferDialog
                    transferId={t.id}
                    numero={t.numero}
                    fromShopNom={t.fromShop.nom}
                    toShopNom={t.toShop.nom}
                    statut={t.statut}
                    lines={t.lines.map((l) => ({
                      id: l.id,
                      designation: l.variant.product.designation,
                      quantiteDemandee: Number(l.quantiteDemandee),
                      quantiteExpediee: l.quantiteExpediee !== null ? Number(l.quantiteExpediee) : null,
                      quantiteRecue: l.quantiteRecue !== null ? Number(l.quantiteRecue) : null,
                    }))}
                  />
                </TableCell>
              </TableRow>
            ))}
            {transfers.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Aucun transfert pour l&apos;instant. Créez-en un avec « Nouveau transfert ».
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TablePanel>
    </Page>
  );
}
