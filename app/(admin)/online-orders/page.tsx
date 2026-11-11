import { redirect } from "next/navigation";

import { ShoppingBag } from "lucide-react";

import { FilterTabs } from "@/components/admin/filter-tabs";
import { EmptyState, Page, PageHeader, TablePanel } from "@/components/admin/page";
import { Badge } from "@/components/ui/badge";
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
import { paymentFailure } from "@/lib/payments/failure";

import { LiveUpdates } from "./live-updates";
import { OnlineOrderDialog } from "./online-order-dialog";
import { PushSubscribeButton } from "./push-subscribe-button";

const STATUS_LABELS: Record<string, string> = {
  EN_ATTENTE: "En attente",
  CONFIRMEE: "Confirmée",
  PRETE: "Prête",
  RECUPEREE: "Récupérée",
  ANNULEE: "Annulée",
};

const STATUS_TONES: Record<string, "warning" | "default" | "success" | "secondary" | "destructive"> = {
  EN_ATTENTE: "warning",
  CONFIRMEE: "default",
  PRETE: "success",
  RECUPEREE: "secondary",
  ANNULEE: "destructive",
};

export default async function OnlineOrdersPage({ searchParams }: { searchParams: Promise<{ filtre?: string }> }) {
  const { filtre } = await searchParams;
  const ctx = await getTenantContext();
  const organization = await systemPrisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
  });

  // Deux axes distincts (Phase 4, décision #2) : la capacité ET le module.
  if (
    !hasCapability(ctx.role, "ecommerce:manage") ||
    !organizationHasModule(organization.enabledModules, "ecommerce")
  ) {
    redirect("/dashboard");
  }

  const myShopIds = await getAssignedShopIds(ctx.organizationId, ctx.userId);
  const orders = await withTenantContext({ organizationId: ctx.organizationId }, (tx) =>
    tx.onlineOrder.findMany({
      where: { shopId: { in: myShopIds } },
      orderBy: { createdAt: "desc" },
      include: {
        shop: true,
        lines: { include: { variant: { include: { product: true } } } },
        payments: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      take: 100,
    }),
  );

  // Même définition de "à traiter" que le badge du menu (app/(admin)/layout.tsx).
  const enAttente = orders.filter((o) => o.statut === "EN_ATTENTE" || o.statut === "CONFIRMEE");
  const showAll = filtre === "toutes";
  const visible = showAll ? orders : enAttente;

  return (
    <Page>
      <LiveUpdates latestOrderCreatedAt={orders[0]?.createdAt.toISOString() ?? null} />
      <PageHeader
        title="Commandes en ligne"
        description={<>Commandes passées sur la boutique en ligne. L&apos;encaissement en boutique les convertit en vente.</>}
        actions={<PushSubscribeButton />}
      />

      <FilterTabs
        items={[
          { label: "À traiter", href: "/online-orders", active: !showAll, count: enAttente.length },
          { label: "Toutes", href: "/online-orders?filtre=toutes", active: showAll },
        ]}
      />

      <TablePanel>
        {visible.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title={showAll ? "Aucune commande en ligne" : "Aucune commande à traiter"}
            description={
              showAll
                ? "Les commandes passées sur votre boutique en ligne apparaîtront ici."
                : "Toutes les commandes ont été traitées. Les nouvelles s'afficheront ici automatiquement."
            }
          />
        ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Commande</TableHead>
              <TableHead>Client</TableHead>
              <TableHead className="hidden md:table-cell">Boutique</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((o) => (
              <TableRow key={o.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="num font-medium text-foreground">{o.numero}</span>
                    <span className="text-xs text-muted-foreground">{o.createdAt.toLocaleDateString("fr-FR")}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{o.nomClient}</TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">{o.shop.nom}</TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-1">
                    <Badge variant={STATUS_TONES[o.statut] ?? "secondary"}>{STATUS_LABELS[o.statut] ?? o.statut}</Badge>
                    {o.payments[0]?.statut === "REUSSI" && o.statut === "ANNULEE" ? (
                      <Badge variant="destructive">
                        Payée en ligne mais annulée — réconciliation manuelle requise
                      </Badge>
                    ) : o.payments[0]?.statut === "REUSSI" ? (
                      <Badge variant="success">Payée en ligne</Badge>
                    ) : o.payments[0]?.statut === "ECHEC" || o.payments[0]?.statut === "EXPIRE" ? (
                      <span className="flex flex-col gap-0.5">
                        <Badge variant="secondary">Paiement échoué</Badge>
                        <span className="text-xs text-muted-foreground">
                          {paymentFailure(o.payments[0])?.message}
                        </span>
                      </span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="num text-right">
                  {formatMoney(o.totalTtc, organization.devise)}
                </TableCell>
                <TableCell className="text-right">
                  <OnlineOrderDialog
                    orderId={o.id}
                    numero={o.numero}
                    statut={o.statut}
                    shopNom={o.shop.nom}
                    nomClient={o.nomClient}
                    telephoneClient={o.telephoneClient}
                    modeRetrait={o.modeRetrait}
                    adresseLivraison={o.adresseLivraison}
                    notes={o.notes}
                    lines={o.lines.map((l) => ({
                      id: l.id,
                      designation: l.variant.product.designation,
                      quantite: Number(l.quantite),
                      prixUnitaireLabel: formatMoney(l.prixUnitaire, organization.devise),
                    }))}
                    emballageQuantite={o.emballageQuantite}
                    emballagePrixUnitaireLabel={
                      o.emballagePrixUnitaire !== null
                        ? formatMoney(o.emballagePrixUnitaire, organization.devise)
                        : null
                    }
                    fraisLivraisonLabel={
                      Number(o.fraisLivraison) > 0 ? formatMoney(o.fraisLivraison, organization.devise) : null
                    }
                    totalTtc={Number(o.totalTtc)}
                    totalTtcLabel={formatMoney(o.totalTtc, organization.devise)}
                    saleId={o.saleId}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        )}
      </TablePanel>
    </Page>
  );
}
