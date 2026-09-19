"use client";

import { jsPDF } from "jspdf";

import type { TicketData } from "@/app/(pos)/caisse/printable-ticket";
import { formatMoney } from "@/lib/money";

const PAYMENT_LABELS: Record<string, string> = {
  ESPECES: "Espèces",
  MOBILE_MONEY: "Mobile Money",
  CARTE: "Carte",
  VIREMENT: "Virement",
  ARDOISE: "Ardoise",
  BON_ACHAT: "Bon d'achat",
};

const PAGE_WIDTH_MM = 80;
const MARGIN_MM = 4;
const LINE_HEIGHT_MM = 4.5;
const CONTENT_WIDTH_MM = PAGE_WIDTH_MM - MARGIN_MM * 2;

// Intl.NumberFormat("fr-FR", ...) sépare les milliers avec U+202F (espace
// fine insécable) et le montant de la devise avec U+00A0 (espace insécable)
// — aucun des deux glyphes n'existe dans l'encodage WinAnsi des polices de
// base de jsPDF (Courier ici) : sans ce remplacement, doc.text() rendait le
// montant entier invisible (bug réel constaté : toutes les colonnes de
// droite — prix, sous-total, taxe, total, paiement — étaient vides sur le
// PDF téléchargé, alors qu'elles s'affichent normalement en HTML/impression
// où le navigateur gère n'importe quel caractère Unicode).
function pdfSafe(text: string): string {
  return text.replace(/[  ]/g, " ");
}

// Même contenu que printable-ticket.tsx (organisation, lignes, sous-total/
// taxe dérivés de ticket.totalHt, total, paiements) — jamais un second
// calcul de la taxe ici, uniquement une mise en page différente du même
// TicketData déjà correct. Format 80mm façon reçu de caisse, comme le CSS
// d'impression (globals.css, @page 80mm auto), plutôt qu'un A4 à moitié
// vide — hauteur calculée sur le nombre de lignes réelles (y compris les
// retours à la ligne d'un nom d'organisation ou d'une désignation trop
// longue pour 80mm, jamais tronqués en silence).
export function downloadTicketPdf(ticket: TicketData): void {
  const taxe = ticket.totalTtc - ticket.totalHt;
  const showTaxe = Math.abs(taxe) > 0.01;

  // jsPDF a besoin d'une instance pour mesurer le texte (splitTextToSize) —
  // page provisoire, redimensionnée une fois la hauteur réelle connue.
  const measure = new jsPDF({ unit: "mm", format: [PAGE_WIDTH_MM, 100] });
  measure.setFont("courier", "bold");
  measure.setFontSize(10);
  const headerLines = measure.splitTextToSize(pdfSafe(ticket.organizationNom), CONTENT_WIDTH_MM);
  measure.setFont("courier", "normal");
  measure.setFontSize(8);
  const subHeaderLines = measure.splitTextToSize(
    pdfSafe(`Ticket ${ticket.numero} - ${new Date(ticket.createdAt).toLocaleString("fr-FR")}`),
    CONTENT_WIDTH_MM,
  );
  const lineRows = ticket.lines.map((l) =>
    measure.splitTextToSize(pdfSafe(`${l.quantite} x ${l.designation}`), CONTENT_WIDTH_MM * 0.65),
  );

  const rowCount =
    headerLines.length +
    subHeaderLines.length +
    lineRows.reduce((sum: number, rows: string[]) => sum + rows.length, 0) +
    (showTaxe ? 2 : 0) +
    1 + // total
    ticket.payments.length;
  const heightMm = MARGIN_MM * 2 + rowCount * LINE_HEIGHT_MM + 6;

  // Piège jsPDF : en orientation "portrait" (défaut), si la largeur dépasse la
  // hauteur, la bibliothèque ÉCHANGE les deux. Un ticket court (moins de 80mm
  // de haut, soit la plupart des tickets) devenait donc une page de
  // "hauteur × 80mm" : plus étroite que prévu, avec le texte aligné à droite
  // (tous les montants) et le nom d'organisation coupés hors de la page. On
  // déclare l'orientation qui correspond aux dimensions réelles pour que
  // jsPDF n'ait rien à corriger.
  const doc = new jsPDF({
    orientation: PAGE_WIDTH_MM > heightMm ? "landscape" : "portrait",
    unit: "mm",
    format: [PAGE_WIDTH_MM, heightMm],
  });
  const left = MARGIN_MM;
  const right = PAGE_WIDTH_MM - MARGIN_MM;
  const center = PAGE_WIDTH_MM / 2;
  let y = MARGIN_MM;

  function row(labelLeft: string, labelRight: string) {
    doc.text(pdfSafe(labelLeft), left, y);
    doc.text(pdfSafe(labelRight), right, y, { align: "right" });
    y += LINE_HEIGHT_MM;
  }

  doc.setFont("courier", "bold");
  doc.setFontSize(10);
  for (const line of headerLines) {
    doc.text(line, center, y, { align: "center" });
    y += LINE_HEIGHT_MM;
  }

  doc.setFont("courier", "normal");
  doc.setFontSize(8);
  for (const line of subHeaderLines) {
    doc.text(line, center, y, { align: "center" });
    y += LINE_HEIGHT_MM;
  }
  y += LINE_HEIGHT_MM * 0.3;

  doc.setLineDashPattern([0.5, 0.5], 0);
  doc.line(left, y, right, y);
  y += LINE_HEIGHT_MM;

  ticket.lines.forEach((l, i) => {
    const amount = formatMoney(l.prixUnitaire * l.quantite - l.remise, ticket.devise);
    const rows = lineRows[i];
    doc.text(rows[0], left, y);
    doc.text(pdfSafe(amount), right, y, { align: "right" });
    y += LINE_HEIGHT_MM;
    for (const extra of rows.slice(1)) {
      doc.text(extra, left, y);
      y += LINE_HEIGHT_MM;
    }
  });

  doc.line(left, y, right, y);
  y += LINE_HEIGHT_MM;

  if (showTaxe) {
    row("Sous-total", formatMoney(ticket.totalHt, ticket.devise));
    row("Taxe", formatMoney(taxe, ticket.devise));
  }

  doc.setFont("courier", "bold");
  row("Total", formatMoney(ticket.totalTtc, ticket.devise));
  doc.setFont("courier", "normal");

  for (const p of ticket.payments) {
    row(PAYMENT_LABELS[p.mode] ?? p.mode, formatMoney(p.montant, ticket.devise));
  }

  doc.save(`ticket-${ticket.numero}.pdf`);
}
