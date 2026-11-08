import type { LaundryOrderStatus } from "@prisma/client";
import Link from "next/link";

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
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Commandes blanchisserie</h1>
        <p className="text-sm text-muted-foreground">
          Appelez le client pour organiser la collecte et le retour, puis faites avancer la commande étape par étape.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={`/laundry/orders?statut=${f.value}`}
            className={cn(
              "rounded-full border px-3 py-1 text-sm",
              f.value === filter
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Numéro</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Boutique</TableHead>
              <TableHead>Aller / retour</TableHead>
              <TableHead className="text-right">Pièces</TableHead>
              <TableHead className="text-right">Total déclaré</TableHead>
              <TableHead>Régularisation</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((o) => {
              const pieces = o.lines.reduce((n, l) => n + l.quantiteDeclaree, 0);
              const regul = o.regularisation === null ? null : Number(o.regularisation);
              return (
                <TableRow key={o.id}>
                  <TableCell>
                    <Link href={`/laundry/orders/${o.id}`} className="font-medium text-primary hover:underline">
                      {o.numero}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-foreground">{o.nomClient}</span>
                      <PhoneLink telephone={o.telephoneClient} className="text-xs" />
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{o.shop.nom}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {PICKUP_LABELS[o.modeAller]}
                    <br />
                    {RETURN_LABELS[o.modeRetour]}
                  </TableCell>
                  <TableCell className="num text-right">{pieces}</TableCell>
                  <TableCell className="num text-right">{formatMoney(o.totalDeclare, devise)}</TableCell>
                  <TableCell>
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
                  <TableCell className="text-muted-foreground">{o.createdAt.toLocaleDateString("fr-FR")}</TableCell>
                </TableRow>
              );
            })}
            {orders.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">
                  Aucune commande.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
