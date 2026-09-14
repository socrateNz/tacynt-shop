import { formatMoney } from "@/lib/money";

export type TicketData = {
  numero: string;
  createdAt: string;
  organizationNom: string;
  lines: { designation: string; quantite: number; prixUnitaire: number; remise: number }[];
  payments: { mode: string; montant: number }[];
  totalHt: number;
  totalTtc: number;
  devise: string;
};

const PAYMENT_LABELS: Record<string, string> = {
  ESPECES: "Espèces",
  MOBILE_MONEY: "Mobile Money",
  CARTE: "Carte",
  VIREMENT: "Virement",
  ARDOISE: "Ardoise",
  BON_ACHAT: "Bon d'achat",
};

export function PrintableTicket({ ticket }: { ticket: TicketData }) {
  // ticket.totalHt vient toujours d'un calcul fait en amont avec
  // lib/sales/tax.ts (panier caisse ou lib/sales/apply-sale.ts côté
  // serveur) — jamais recalculé ici depuis les lignes affichées. Selon le
  // réglage taxeRetenueSource de la boutique au moment de la vente, le prix
  // affiché par ligne peut être HT (taxe ajoutée) ou déjà TTC (taxe
  // retenue à la source) ; seul totalHt encode laquelle des deux s'applique
  // (bug réel constaté : le total sautait de 50 000 à 59 625 sans qu'aucune
  // ligne n'explique l'écart, faute de sous-total correct).
  const taxe = ticket.totalTtc - ticket.totalHt;
  const showTaxe = Math.abs(taxe) > 0.01;

  return (
    <div className="printable-ticket mx-auto w-full max-w-[80mm] bg-background p-3 font-mono text-xs text-foreground">
      <p className="text-center font-semibold">{ticket.organizationNom}</p>
      <p className="text-center text-muted-foreground">
        Ticket {ticket.numero} — {new Date(ticket.createdAt).toLocaleString("fr-FR")}
      </p>
      <hr className="my-2 border-dashed border-border" />
      {ticket.lines.map((l, i) => (
        <div key={i} className="flex justify-between gap-2">
          <span>
            {l.quantite} × {l.designation}
          </span>
          <span className="num">
            {formatMoney(l.prixUnitaire * l.quantite - l.remise, ticket.devise)}
          </span>
        </div>
      ))}
      <hr className="my-2 border-dashed border-border" />
      {showTaxe && (
        <>
          <div className="flex justify-between text-muted-foreground">
            <span>Sous-total</span>
            <span className="num">{formatMoney(ticket.totalHt, ticket.devise)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Taxe</span>
            <span className="num">{formatMoney(taxe, ticket.devise)}</span>
          </div>
        </>
      )}
      <div className="flex justify-between font-semibold">
        <span>Total</span>
        <span className="num">{formatMoney(ticket.totalTtc, ticket.devise)}</span>
      </div>
      {ticket.payments.map((p, i) => (
        <div key={i} className="flex justify-between text-muted-foreground">
          <span>{PAYMENT_LABELS[p.mode] ?? p.mode}</span>
          <span className="num">{formatMoney(p.montant, ticket.devise)}</span>
        </div>
      ))}
    </div>
  );
}
