import { formatMoney } from "@/lib/money";

export type TicketData = {
  numero: string;
  createdAt: string;
  organizationNom: string;
  lines: { designation: string; quantite: number; prixUnitaire: number; remise: number }[];
  payments: { mode: string; montant: number }[];
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
