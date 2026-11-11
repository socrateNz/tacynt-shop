import { notFound } from "next/navigation";

import { Page, PageHeader } from "@/components/admin/page";
import { PhoneLink } from "@/components/phone-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { withTenantContext } from "@/lib/db/tenant-context";
import {
  LAUNDRY_STATUS_LABELS,
  LAUNDRY_STATUS_VARIANTS,
  laundryCancellable,
  nextStepLabel,
  PICKUP_LABELS,
  RETURN_LABELS,
} from "@/lib/laundry/types";
import { formatMoney } from "@/lib/money";
import { paymentFailure } from "@/lib/payments/failure";
import { PROVIDER_LABEL } from "@/lib/payments/methods";
import { getAssignedShopIds } from "@/lib/tenant/active-shop";
import { cn } from "@/lib/utils";

import { advanceLaundryOrder, cancelLaundryOrder } from "../../actions";
import { requireLaundryPage } from "../../guard";
import { RecountForm } from "./recount-form";

export default async function LaundryOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { ctx, organization } = await requireLaundryPage();
  const { id } = await params;
  const myShopIds = await getAssignedShopIds(ctx.organizationId, ctx.userId);

  const order = await withTenantContext({ organizationId: ctx.organizationId }, (tx) =>
    tx.laundryOrder.findUnique({
      where: { id },
      include: {
        shop: { select: { nom: true } },
        lines: { orderBy: { designation: "asc" } },
        payments: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
  );
  if (!order || !myShopIds.includes(order.shopId)) notFound();

  const devise = organization.devise;
  const stepLabel = nextStepLabel(order.statut, order.modeAller, order.modeRetour);
  const recountEditable = ["COLLECTEE", "EN_LAVAGE", "PRETE"].includes(order.statut);
  const regul = order.regularisation === null ? null : Number(order.regularisation);
  const pieces = order.lines.reduce((n, l) => n + l.quantiteDeclaree, 0);
  const domicile = order.modeAller === "COLLECTE_DOMICILE" || order.modeRetour === "LIVRAISON";
  const lastPayment = order.payments[0];
  const paiement =
    order.modePaiement === "RECEPTION"
      ? { label: "À payer à la réception du linge", className: "text-muted-foreground" }
      : lastPayment?.statut === "REUSSI"
        ? { label: `Payée en ligne — ${PROVIDER_LABEL[lastPayment.fournisseur]}`, className: "text-success" }
        : lastPayment?.statut === "ECHEC" || lastPayment?.statut === "EXPIRE"
          ? {
              label: `Paiement en ligne non abouti — ${paymentFailure(lastPayment)?.message ?? ""}`,
              className: "text-destructive",
            }
          : { label: "Paiement en ligne en attente", className: "text-warning" };

  return (
    <Page>
      <PageHeader
        back={{ href: "/laundry/orders", label: "Commandes blanchisserie" }}
        title={<>Commande {order.numero}</>}
        meta={<Badge variant={LAUNDRY_STATUS_VARIANTS[order.statut]}>{LAUNDRY_STATUS_LABELS[order.statut]}</Badge>}
        description={
          <>
            {order.shop.nom} — passée le {order.createdAt.toLocaleDateString("fr-FR")} — {pieces} pièce
            {pieces > 1 ? "s" : ""} déclarée{pieces > 1 ? "s" : ""}
          </>
        }
        actions={
          <>
            {laundryCancellable(order.statut) && (
              <form action={cancelLaundryOrder}>
                <input type="hidden" name="orderId" value={order.id} />
                <Button type="submit" variant="outline" className="text-destructive hover:text-destructive">
                  Annuler la commande
                </Button>
              </form>
            )}
            {stepLabel && (
              <form action={advanceLaundryOrder}>
                <input type="hidden" name="orderId" value={order.id} />
                <Button type="submit">{stepLabel}</Button>
              </form>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <p className="text-xs text-muted-foreground">Client</p>
          <p className="text-foreground">{order.nomClient}</p>
          <PhoneLink telephone={order.telephoneClient} className="text-sm" />
          {order.emailClient && <p className="text-sm text-muted-foreground">{order.emailClient}</p>}
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <p className="text-xs text-muted-foreground">Aller / retour</p>
          <p className="text-foreground">{PICKUP_LABELS[order.modeAller]}</p>
          <p className="text-foreground">{RETURN_LABELS[order.modeRetour]}</p>
          {domicile && order.zoneLivraisonNom && (
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{order.zoneLivraisonNom}</span> — {order.lieuDit}
            </p>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <p className="text-xs text-muted-foreground">Montants</p>
          <p className="text-sm text-muted-foreground">
            Articles déclarés : <span className="num text-foreground">{formatMoney(order.montantDeclare, devise)}</span>
          </p>
          {Number(order.fraisCollecte) > 0 && (
            <p className="text-sm text-muted-foreground">
              Collecte : <span className="num text-foreground">{formatMoney(order.fraisCollecte, devise)}</span>
            </p>
          )}
          {Number(order.fraisLivraison) > 0 && (
            <p className="text-sm text-muted-foreground">
              Livraison : <span className="num text-foreground">{formatMoney(order.fraisLivraison, devise)}</span>
            </p>
          )}
          <p className="text-sm font-semibold text-foreground">
            Total à payer : <span className="num text-primary">{formatMoney(order.totalDeclare, devise)}</span>
          </p>
          <p className={cn("text-sm font-medium", paiement.className)}>{paiement.label}</p>
          <p className="mt-1 text-sm">
            {regul === null ? (
              <span className="text-muted-foreground">Régularisation : après recomptage</span>
            ) : regul === 0 ? (
              <span className="text-success">Recomptage conforme — rien à régulariser</span>
            ) : (
              <span className={cn("font-semibold", regul > 0 ? "text-warning" : "text-primary")}>
                {regul > 0
                  ? `À encaisser au retour : ${formatMoney(regul, devise)}`
                  : `À rendre au retour : ${formatMoney(-regul, devise)}`}
              </span>
            )}
          </p>
        </div>
      </div>

      {order.notes && (
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <p className="text-xs text-muted-foreground">Note du client</p>
          <p className="text-sm text-foreground">{order.notes}</p>
        </div>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold text-foreground">
          Pièces{recountEditable ? " — recomptage à la réception du linge" : ""}
        </h2>
        <RecountForm
          orderId={order.id}
          devise={devise}
          editable={recountEditable}
          montantDeclare={Number(order.montantDeclare)}
          lines={order.lines.map((l) => ({
            id: l.id,
            designation: l.designation,
            prixUnitaire: Number(l.prixUnitaire),
            quantiteDeclaree: l.quantiteDeclaree,
            quantiteRecomptee: l.quantiteRecomptee,
          }))}
        />
      </section>
    </Page>
  );
}
