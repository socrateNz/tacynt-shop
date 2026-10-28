import { Plus } from "lucide-react";
import { redirect } from "next/navigation";

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
import { ViewDetailDialog } from "@/components/ui/view-detail-dialog";
import { systemPrisma } from "@/lib/db/system-client";
import { withTenantContext } from "@/lib/db/tenant-context";
import { formatMoney } from "@/lib/money";
import { hasCapability } from "@/lib/permissions";
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";
import { profileHasLots, profileHasSerialNumbers } from "@/lib/tenant/profile";

import { AdjustStockForm } from "./adjust-stock-form";
import { resolveStockAlert } from "./actions";
import { ReceiveStockForm } from "./receive-stock-form";

function variantLabel(variant: { product: { designation: string }; attributs: unknown; codeBarres: string | null }) {
  const attrs = variant.attributs as Record<string, string>;
  const attrLabel = Object.entries(attrs)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
  return `${variant.product.designation}${attrLabel ? ` — ${attrLabel}` : ""}${variant.codeBarres ? ` (${variant.codeBarres})` : ""}`;
}

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

export default async function StockMovementsPage() {
  const ctx = await getTenantContext();
  if (!hasCapability(ctx.role, "stock:read")) {
    redirect("/dashboard");
  }

  const shopId = await getActiveShopId(ctx.organizationId, ctx.userId);
  const organization = await systemPrisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
  });

  const showLots = profileHasLots(organization.profilMetier);
  const showSerial = profileHasSerialNumbers(organization.profilMetier);
  // Capturé une seule fois : un Date.now() appelé pendant le rendu (JSX)
  // est une fonction impure interdite par la règle react-hooks/purity,
  // même côté serveur.
  const now = new Date();

  const [levels, movements, variants, expiringLots, stockAlerts] = await withTenantContext(
    { organizationId: ctx.organizationId, shopId },
    async (tx) => {
      const levels = await tx.stockLevel.findMany({
        where: { shopId },
        include: {
          variant: { include: { product: true, shopPrices: { where: { shopId } } } },
        },
        orderBy: { variant: { product: { designation: "asc" } } },
      });
      const movements = await tx.stockMovement.findMany({
        where: { shopId },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { variant: { include: { product: true } }, lot: true },
      });
      const variants = await tx.productVariant.findMany({
        where: { actif: true, product: { suiviStock: true } },
        include: { product: true },
        orderBy: { product: { designation: "asc" } },
      });
      // Alerte configurable à J-30 (section 5.1) — les lots déjà à 0 ne
      // sont plus pertinents à afficher.
      const expiringLots = showLots
        ? await tx.lot.findMany({
            where: {
              shopId,
              quantite: { gt: 0 },
              datePeremption: { lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) },
            },
            include: { variant: { include: { product: true } } },
            orderBy: { datePeremption: "asc" },
          })
        : [];
      // Écrit depuis Phase 3 (lib/sales/apply-sale.ts, stock négatif après
      // resynchro offline) mais jamais lu nulle part avant ça — simple
      // oubli, le modèle (resolvedAt) prévoyait déjà ce flux.
      const stockAlerts = await tx.stockAlert.findMany({
        where: { shopId, resolvedAt: null },
        include: { variant: { include: { product: true } } },
        orderBy: { createdAt: "desc" },
      });
      return [levels, movements, variants, expiringLots, stockAlerts] as const;
    },
  );

  const canWrite = hasCapability(ctx.role, "stock:write");

  // Dérivé à la volée (pas de nouveau modèle) : seuilAlerte est configuré
  // par variante/boutique sur ShopPrice (formulaire produit/variante), mais
  // rien ne le confrontait jamais au stock réel avant ça.
  const lowStockLevels = levels.filter((l) => {
    const seuil = l.variant.shopPrices[0]?.seuilAlerte;
    return seuil !== null && seuil !== undefined && Number(l.quantite) <= seuil;
  });

  const userIds = [...new Set(movements.map((m) => m.userId).filter((id): id is string => !!id))];
  const users = userIds.length
    ? await systemPrisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, nom: true } })
    : [];
  const nomByUserId = new Map(users.map((u) => [u.id, u.nom]));

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Stock</h1>
        <p className="text-sm text-muted-foreground">
          Le stock n&apos;est jamais une valeur qu&apos;on écrit — c&apos;est la somme des
          mouvements.
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-foreground">Niveaux actuels</h2>
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produit</TableHead>
                <TableHead className="text-right">Quantité</TableHead>
                <TableHead className="text-right">CUMP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {levels.map((l) => (
                <TableRow key={`${l.variantId}-${l.shopId}`}>
                  <TableCell className="text-foreground">
                    {variantLabel(l.variant)}
                  </TableCell>
                  <TableCell className="num text-right">{l.quantite.toString()}</TableCell>
                  <TableCell className="num text-right">
                    {formatMoney(l.cump, organization.devise)}
                  </TableCell>
                </TableRow>
              ))}
              {levels.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    Aucun mouvement de stock pour l&apos;instant.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {showLots && expiringLots.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-medium text-foreground">
            Alertes péremption (30 jours)
          </h2>
          <div className="rounded-xl border border-warning/30 bg-warning/10 p-4">
            <ul className="flex flex-col gap-1 text-sm">
              {expiringLots.map((l) => {
                const joursRestants = l.datePeremption
                  ? Math.ceil((l.datePeremption.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
                  : null;
                return (
                  <li
                    key={l.id}
                    className={joursRestants !== null && joursRestants <= 7 ? "text-destructive" : "text-foreground"}
                  >
                    {variantLabel(l.variant)} — lot {l.numero} — {l.quantite.toString()} unité(s) —
                    {joursRestants !== null && joursRestants < 0
                      ? " périmé"
                      : ` J-${joursRestants}`}
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}

      {stockAlerts.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-medium text-foreground">Alertes de stock négatif</h2>
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4">
            <ul className="flex flex-col gap-2 text-sm">
              {stockAlerts.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 text-destructive">
                  <span>
                    {variantLabel(a.variant)} — écart {a.ecart.toString()} —{" "}
                    {a.createdAt.toLocaleString("fr-FR")}
                  </span>
                  {canWrite && (
                    <form action={resolveStockAlert}>
                      <input type="hidden" name="alertId" value={a.id} />
                      <Button type="submit" variant="ghost" size="sm">
                        Marquer résolu
                      </Button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {lowStockLevels.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-medium text-foreground">Stock bas</h2>
          <div className="rounded-xl border border-warning/30 bg-warning/10 p-4">
            <ul className="flex flex-col gap-1 text-sm text-foreground">
              {lowStockLevels.map((l) => (
                <li key={`${l.variantId}-${l.shopId}`}>
                  {variantLabel(l.variant)} — {l.quantite.toString()} restant(s) (seuil{" "}
                  {l.variant.shopPrices[0]?.seuilAlerte})
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {canWrite && (
        <div className="flex flex-wrap gap-2">
          <Dialog>
            <DialogTrigger render={<Button className="gap-1.5" />}>
              <Plus className="size-4" />
              Réceptionner du stock
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Réception de stock</DialogTitle>
              </DialogHeader>
              <ReceiveStockForm
                showLots={showLots}
                showSerial={showSerial}
                variants={variants.map((v) => ({
                  id: v.id,
                  label: variantLabel(v),
                }))}
              />
            </DialogContent>
          </Dialog>
          <Dialog>
            <DialogTrigger render={<Button variant="outline" className="gap-1.5" />}>
              <Plus className="size-4" />
              Ajuster le stock
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Ajustement d&apos;inventaire (comptage, casse, perte)</DialogTitle>
              </DialogHeader>
              <AdjustStockForm
                variants={variants.map((v) => ({
                  id: v.id,
                  label: variantLabel(v),
                }))}
              />
            </DialogContent>
          </Dialog>
        </div>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-foreground">Derniers mouvements</h2>
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Produit</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Quantité</TableHead>
                <TableHead className="text-right">Coût unitaire</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="text-muted-foreground">
                    {m.createdAt.toLocaleString("fr-FR")}
                  </TableCell>
                  <TableCell className="text-foreground">
                    {variantLabel(m.variant)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{m.type}</TableCell>
                  <TableCell className="num text-right">{m.quantite.toString()}</TableCell>
                  <TableCell className="num text-right">
                    {formatMoney(m.coutUnitaire, organization.devise)}
                  </TableCell>
                  <TableCell className="text-right">
                    <ViewDetailDialog
                      title="Mouvement de stock"
                      rows={[
                        { label: "Date", value: m.createdAt.toLocaleString("fr-FR") },
                        { label: "Produit", value: variantLabel(m.variant) },
                        { label: "Type", value: TYPE_LABELS[m.type] ?? m.type },
                        { label: "Quantité", value: m.quantite.toString() },
                        {
                          label: "Coût unitaire",
                          value: formatMoney(m.coutUnitaire, organization.devise),
                        },
                        ...(m.lot ? [{ label: "Lot", value: m.lot.numero }] : []),
                        ...(m.motif ? [{ label: "Motif", value: m.motif }] : []),
                        ...(m.userId && nomByUserId.has(m.userId)
                          ? [{ label: "Utilisateur", value: nomByUserId.get(m.userId)! }]
                          : []),
                        ...(m.documentType
                          ? [
                              {
                                label: "Document source",
                                value: `${m.documentType}${m.documentId ? ` (${m.documentId})` : ""}`,
                              },
                            ]
                          : []),
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {movements.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Aucun mouvement pour l&apos;instant.
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
