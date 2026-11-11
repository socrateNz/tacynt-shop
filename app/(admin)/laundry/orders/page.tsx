import type { LaundryOrderStatus } from "@prisma/client";
import Link from "next/link";

import { ChevronRight } from "lucide-react";

import { FilterTabs } from "@/components/admin/filter-tabs";
import { Page, PageHeader, TablePanel } from "@/components/admin/page";
import { buttonVariants } from "@/components/ui/button";
import { PhoneLink } from "@/components/phone-link";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { withTenantContext } from "@/lib/db/tenant-context";
import { LAUNDRY_STATUS_LABELS, LAUNDRY_STATUS_VARIANTS, PICKUP_LABELS, RETURN_LABELS } from "@/lib/laundry/types";
import { formatMoney } from "@/lib/money";
import { getAssignedShopIds } from "@/lib/tenant/active-shop";
import { cn } from "@/lib/utils";

import { requireLaundryPage } from "../guard";

const FILTERS: { value: LaundryOrderStatus | "actives" | "toutes"; label: string }[] = [
  { value: "actives", label: "En cours" },
  { value: "EN_ATTENTE", label: "En attente" },
  { value: "PRETE", label: "Prêtes" },
  { value: "TERMINEE", label: "Terminées" },
  { value: "ANNULEE", label: "Annulées" },
  { value: "toutes", label: "Toutes" },
];

export default async function LaundryOrdersPage({ searchParams }: { searchParams: Promise<{ statut?: string }> }) {
  const { ctx, organization } = await requireLaundryPage();
  const { statut } = await searchParams;
  const filter = FILTERS.find((f) => f.value === statut)?.value ?? "actives";
  const myShopIds = await getAssignedShopIds(ctx.organizationId, ctx.userId);

  const orders = await withTenantContext({ organizationId: ctx.organizationId }, (tx) =>
    tx.laundryOrder.findMany({
      where: {
        shopId: { in: myShopIds },
        ...(filter === "actives"
          ? { statut: { notIn: ["TERMINEE", "ANNULEE"] as LaundryOrderStatus[] } }
          : filter === "toutes"
            ? {}
            : { statut: filter }),
      },
      include: { shop: { select: { nom: true } }, lines: { select: { quantiteDeclaree: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  );
  const devise = organization.devise;

  return (
    <Page>
      <PageHeader
        title="Commandes blanchisserie"
        description="Appelez le client pour organiser la collecte et le retour, puis faites avancer la commande étape par étape."
      />

      <FilterTabs
        items={FILTERS.map((f) => ({
          label: f.label,
          href: `/laundry/orders?statut=${f.value}`,
          active: f.value === filter,
        }))}
      />

      <TablePanel>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Numéro</TableHead>
              <TableHead>Client</TableHead>
              <TableHead className="hidden xl:table-cell">Boutique</TableHead>
              <TableHead className="hidden lg:table-cell">Aller / retour</TableHead>
              <TableHead className="hidden text-right md:table-cell">Pièces</TableHead>
              <TableHead className="text-right">Total déclaré</TableHead>
              <TableHead className="hidden lg:table-cell">Régularisation</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="w-10">
                <span className="sr-only">Ouvrir</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((o) => {
              const pieces = o.lines.reduce((n, l) => n + l.quantiteDeclaree, 0);
              const regul = o.regularisation === null ? null : Number(o.regularisation);
              return (
                <TableRow key={o.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <Link href={`/laundry/orders/${o.id}`} className="num font-medium text-foreground hover:text-primary hover:underline">
                        {o.numero}
                      </Link>
                      <span className="text-xs text-muted-foreground">{o.createdAt.toLocaleDateString("fr-FR")}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-foreground">{o.nomClient}</span>
                      <PhoneLink telephone={o.telephoneClient} className="text-xs" />
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground xl:table-cell">{o.shop.nom}</TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                    {PICKUP_LABELS[o.modeAller]}
                    <br />
                    {RETURN_LABELS[o.modeRetour]}
                  </TableCell>
                  <TableCell className="num hidden text-right md:table-cell">{pieces}</TableCell>
                  <TableCell className="num text-right">{formatMoney(o.totalDeclare, devise)}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {regul === null ? (
                      <span className="text-xs text-muted-foreground">Non recompté</span>
                    ) : regul === 0 ? (
                      <span className="text-xs text-success">Conforme</span>
                    ) : (
                      <span className={cn("num text-sm font-semibold", regul > 0 ? "text-warning" : "text-primary")}>
                        {regul > 0 ? "+" : "−"}
                        {formatMoney(Math.abs(regul), devise)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={LAUNDRY_STATUS_VARIANTS[o.statut]}>{LAUNDRY_STATUS_LABELS[o.statut]}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/laundry/orders/${o.id}`}
                      aria-label={`Ouvrir la commande ${o.numero}`}
                      className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                    >
                      <ChevronRight />
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
            {orders.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                  Aucune commande dans cette catégorie.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TablePanel>
    </Page>
  );
}
