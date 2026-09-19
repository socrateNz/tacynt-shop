import type { jsPDF as JsPdfClass } from "jspdf";

import { formatMoney } from "@/lib/money";

// Export PDF des rapports : un vrai fichier PDF téléchargé, pas la boîte de
// dialogue d'impression du navigateur (l'ancien window.print() dépendait de
// l'imprimante/du navigateur et imprimait toute la page, menus compris).
//
// buildReportPdf() ne touche ni au DOM ni à window : il reçoit le constructeur
// jsPDF et renvoie le document, ce qui permet de le vérifier tel quel hors
// navigateur. downloadReportPdf() est la seule partie qui télécharge, et charge
// jsPDF à la demande (≈300 Ko, inutile tant que personne n'exporte).

export type PdfColumnFormat = "text" | "money" | "number" | "percent";

export type ReportPdfColumn = { key: string; label: string; format?: PdfColumnFormat };

export type ReportPdfOptions = {
  title: string;
  subtitle?: string;
  organizationNom: string;
  devise: string;
  // Chiffres clés affichés en cartes au-dessus du tableau (déjà formatés).
  summary?: { label: string; value: string }[];
  columns: ReportPdfColumn[];
  rows: Record<string, unknown>[];
  generatedAt?: Date;
};

// Mise en page — millimètres.
const MARGIN_X = 14;
const MARGIN_TOP = 14;
const MARGIN_BOTTOM = 16;
const CELL_PAD_X = 2;
const CELL_PAD_Y = 1.8;
const MIN_TEXT_COL_MM = 24;
const MIN_CONTENT_COL_MM = 8;
const PT_TO_MM = 0.352778;

const COLOR_TEXT: [number, number, number] = [17, 24, 39];
const COLOR_MUTED: [number, number, number] = [107, 114, 128];
const COLOR_HEAD_TEXT: [number, number, number] = [55, 65, 81];
const COLOR_HEAD_BG: [number, number, number] = [243, 244, 246];
const COLOR_LINE: [number, number, number] = [229, 231, 235];

// Les polices de base d'un PDF (Helvetica ici) n'encodent que WinAnsi. Un
// caractère hors de ce jeu ne provoque pas d'erreur : il est rendu vide ou
// remplacé par un glyphe faux, et le texte semble simplement « mangé » — c'est
// exactement ce qui rendait invisibles tous les montants du ticket PDF, à cause
// des espaces insécables que produit Intl.NumberFormat("fr-FR"). On normalise
// donc tout texte avant de le dessiner ou de le mesurer.
const WIN_ANSI_EXTRAS = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");

// Espaces insécables/fines produits par Intl (U+00A0, U+2007, U+2009, U+202F).
function isSpaceLike(code: number): boolean {
  return code === 0xa0 || code === 0x2007 || code === 0x2009 || code === 0x202f;
}

export function pdfSafe(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (isSpaceLike(code) || code === 9 || code === 10 || code === 13) {
      out += " ";
    } else if (
      (code >= 0x20 && code <= 0x7e) ||
      (code >= 0xa1 && code <= 0xff) ||
      WIN_ANSI_EXTRAS.has(ch)
    ) {
      out += ch;
    } else {
      // Lettre accentuée hors WinAnsi (ex. ǎ, ő) : on garde la lettre de base,
      // sinon un point d'interrogation plutôt qu'un trou silencieux.
      let base = "";
      for (const part of ch.normalize("NFD")) {
        const c = part.codePointAt(0) ?? 0;
        if (c >= 0x300 && c <= 0x36f) continue;
        base += c >= 0x20 && c <= 0x7e ? part : "";
      }
      out += base || "?";
    }
  }
  return out;
}

function formatCell(value: unknown, format: PdfColumnFormat, devise: string): string {
  if (value === null || value === undefined || value === "") return "—";
  if (format === "text") return pdfSafe(String(value));

  const n = Number(value);
  if (!Number.isFinite(n)) return pdfSafe(String(value));
  if (format === "money") return pdfSafe(formatMoney(n, devise));
  if (format === "percent") return pdfSafe(`${n.toFixed(1)} %`);
  return pdfSafe(new Intl.NumberFormat("fr-FR").format(n));
}

// splitTextToSize coupe aux espaces seulement : un e-mail ou un code long,
// sans espace, dépasserait de sa colonne et chevaucherait la suivante.
function wrapText(doc: JsPdfClass, text: string, maxWidth: number): string[] {
  const lines: string[] = doc.splitTextToSize(text, maxWidth);
  const out: string[] = [];
  for (const line of lines) {
    if (doc.getTextWidth(line) <= maxWidth + 0.01) {
      out.push(line);
      continue;
    }
    let current = "";
    for (const ch of line) {
      if (current && doc.getTextWidth(current + ch) > maxWidth) {
        out.push(current);
        current = ch;
      } else {
        current += ch;
      }
    }
    if (current) out.push(current);
  }
  return out.length > 0 ? out : [""];
}

function computeColumnWidths(
  doc: JsPdfClass,
  columns: ReportPdfColumn[],
  cells: string[][],
  usableWidth: number,
  bodyPt: number,
): number[] {
  const desired = columns.map((col, i) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(bodyPt);
    let widest = doc.getTextWidth(pdfSafe(col.label));
    doc.setFont("helvetica", "normal");
    for (const row of cells) widest = Math.max(widest, doc.getTextWidth(row[i]));
    return widest + CELL_PAD_X * 2 + 0.5;
  });
  const numeric = columns.map((c) => (c.format ?? "text") !== "text");
  const total = desired.reduce((a, b) => a + b, 0);

  // Tout tient : les colonnes de texte se partagent le surplus.
  if (total <= usableWidth) {
    const receivers = columns.map((_, i) => i).filter((i) => !numeric[i]);
    const targets = receivers.length > 0 ? receivers : columns.map((_, i) => i);
    const targetSum = targets.reduce((sum, i) => sum + desired[i], 0);
    const extra = usableWidth - total;
    return desired.map((w, i) => (targets.includes(i) ? w + (extra * desired[i]) / targetSum : w));
  }

  // Trop large : les colonnes chiffrées gardent leur largeur (un montant coupé
  // en deux est illisible), les colonnes de texte retournent à la ligne.
  const fixedSum = desired.reduce((sum, w, i) => (numeric[i] ? sum + w : sum), 0);
  const textIdx = columns.map((_, i) => i).filter((i) => !numeric[i]);
  const remaining = usableWidth - fixedSum;
  if (textIdx.length > 0 && remaining >= textIdx.length * MIN_TEXT_COL_MM) {
    const textDesiredSum = textIdx.reduce((sum, i) => sum + desired[i], 0);
    return desired.map((w, i) => (numeric[i] ? w : (remaining * desired[i]) / textDesiredSum));
  }

  // Dernier recours : tout est réduit proportionnellement.
  const scale = usableWidth / total;
  return desired.map((w) => Math.max(w * scale, MIN_CONTENT_COL_MM + CELL_PAD_X * 2));
}

export function buildReportPdf(JsPDF: typeof JsPdfClass, options: ReportPdfOptions): JsPdfClass {
  const { title, subtitle, organizationNom, devise, summary, columns, rows } = options;
  const generatedAt = options.generatedAt ?? new Date();

  // 6 colonnes et plus tiennent mal en portrait (journal comptable : pièce,
  // comptes, montant, libellé).
  const landscape = columns.length >= 6;
  const doc = new JsPDF({ orientation: landscape ? "landscape" : "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const usableWidth = pageWidth - MARGIN_X * 2;
  const bottomLimit = pageHeight - MARGIN_BOTTOM;

  const BODY_PT = 8.5;
  const bodyLine = BODY_PT * PT_TO_MM * 1.25;

  doc.setProperties({
    title: pdfSafe(title),
    subject: pdfSafe(subtitle ?? title),
    author: pdfSafe(organizationNom),
    creator: "Tacynt Shop",
  });

  // ---- En-tête du document
  let y = MARGIN_TOP;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_MUTED);
  doc.text(pdfSafe(organizationNom), MARGIN_X, y, { baseline: "top" });
  doc.setFontSize(8);
  doc.text(pdfSafe(`Généré le ${generatedAt.toLocaleString("fr-FR")}`), pageWidth - MARGIN_X, y, {
    baseline: "top",
    align: "right",
  });
  y += 7;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(...COLOR_TEXT);
  const titleLines = wrapText(doc, pdfSafe(title), usableWidth);
  for (const line of titleLines) {
    doc.text(line, MARGIN_X, y, { baseline: "top" });
    y += 17 * PT_TO_MM * 1.2;
  }

  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...COLOR_MUTED);
    for (const line of wrapText(doc, pdfSafe(subtitle), usableWidth)) {
      doc.text(line, MARGIN_X, y, { baseline: "top" });
      y += 9.5 * PT_TO_MM * 1.3;
    }
  }
  y += 3;

  // ---- Chiffres clés
  if (summary && summary.length > 0) {
    const perRow = Math.min(summary.length, landscape ? 5 : 4);
    const gap = 3;
    const cardW = (usableWidth - gap * (perRow - 1)) / perRow;
    const cardH = 14;
    summary.forEach((item, i) => {
      const col = i % perRow;
      const rowIdx = Math.floor(i / perRow);
      const x = MARGIN_X + col * (cardW + gap);
      const top = y + rowIdx * (cardH + gap);
      doc.setDrawColor(...COLOR_LINE);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, top, cardW, cardH, 1.5, 1.5, "S");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...COLOR_MUTED);
      doc.text(pdfSafe(item.label).toUpperCase(), x + 3, top + 3, { baseline: "top", maxWidth: cardW - 6 });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...COLOR_TEXT);
      doc.text(pdfSafe(item.value), x + 3, top + 8, { baseline: "top", maxWidth: cardW - 6 });
    });
    y += Math.ceil(summary.length / perRow) * (cardH + gap) + 2;
  }

  // ---- Tableau
  const formats = columns.map((c) => c.format ?? "text");
  const cells = rows.map((row) => columns.map((c, i) => formatCell(row[c.key], formats[i], devise)));

  doc.setFont("helvetica", "normal");
  doc.setFontSize(BODY_PT);
  const widths = computeColumnWidths(doc, columns, cells, usableWidth, BODY_PT);
  const xs = widths.reduce<number[]>((acc, w, i) => {
    acc.push(i === 0 ? MARGIN_X : acc[i - 1] + widths[i - 1]);
    return acc;
  }, []);

  function drawCell(lines: string[], i: number, top: number) {
    const right = formats[i] !== "text";
    lines.forEach((line, k) => {
      const ty = top + CELL_PAD_Y + k * bodyLine;
      if (right) doc.text(line, xs[i] + widths[i] - CELL_PAD_X, ty, { baseline: "top", align: "right" });
      else doc.text(line, xs[i] + CELL_PAD_X, ty, { baseline: "top" });
    });
  }

  function headerLines(): string[][] {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(BODY_PT);
    return columns.map((c, i) => wrapText(doc, pdfSafe(c.label), widths[i] - CELL_PAD_X * 2));
  }

  function drawHeaderRow(): number {
    const lines = headerLines();
    const height = Math.max(...lines.map((l) => l.length)) * bodyLine + CELL_PAD_Y * 2;
    doc.setFillColor(...COLOR_HEAD_BG);
    doc.rect(MARGIN_X, y, usableWidth, height, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(BODY_PT);
    doc.setTextColor(...COLOR_HEAD_TEXT);
    lines.forEach((l, i) => drawCell(l, i, y));
    y += height;
    return height;
  }

  const rowLines = (cellRow: string[]) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(BODY_PT);
    return cellRow.map((text, i) => wrapText(doc, text, widths[i] - CELL_PAD_X * 2));
  };
  const rowHeight = (lines: string[][]) =>
    Math.max(...lines.map((l) => l.length)) * bodyLine + CELL_PAD_Y * 2;

  // Un en-tête de tableau seul en bas de page serait orphelin : on exige la
  // place de l'en-tête ET de la première ligne avant de le dessiner.
  const firstBodyHeight = cells.length > 0 ? rowHeight(rowLines(cells[0])) : bodyLine + CELL_PAD_Y * 2;
  const headerHeight =
    Math.max(...headerLines().map((l) => l.length)) * bodyLine + CELL_PAD_Y * 2;
  if (y + headerHeight + firstBodyHeight > bottomLimit) {
    doc.addPage();
    y = MARGIN_TOP;
  }
  drawHeaderRow();

  doc.setLineWidth(0.2);
  doc.setDrawColor(...COLOR_LINE);

  if (cells.length === 0) {
    const h = bodyLine + CELL_PAD_Y * 2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(BODY_PT);
    doc.setTextColor(...COLOR_MUTED);
    doc.text("Aucune donnée sur la période.", pageWidth / 2, y + CELL_PAD_Y, {
      baseline: "top",
      align: "center",
    });
    y += h;
    doc.line(MARGIN_X, y, MARGIN_X + usableWidth, y);
  }

  for (const cellRow of cells) {
    const lines = rowLines(cellRow);
    const height = rowHeight(lines);
    if (y + height > bottomLimit) {
      doc.addPage();
      y = MARGIN_TOP;
      drawHeaderRow();
      doc.setLineWidth(0.2);
      doc.setDrawColor(...COLOR_LINE);
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(BODY_PT);
    doc.setTextColor(...COLOR_TEXT);
    lines.forEach((l, i) => drawCell(l, i, y));
    y += height;
    doc.line(MARGIN_X, y, MARGIN_X + usableWidth, y);
  }

  // ---- Pied de page, une fois le nombre de pages connu
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...COLOR_MUTED);
    const footerY = pageHeight - 9;
    const pageLabel = `Page ${p} / ${pageCount}`;
    const leftMax = usableWidth - doc.getTextWidth(pageLabel) - 6;
    const [footerLeft] = wrapText(doc, pdfSafe(`${organizationNom} — ${title}`), leftMax);
    doc.text(footerLeft, MARGIN_X, footerY, { baseline: "top" });
    doc.text(pageLabel, pageWidth - MARGIN_X, footerY, { baseline: "top", align: "right" });
  }

  return doc;
}

export async function downloadReportPdf(options: ReportPdfOptions, filename: string): Promise<void> {
  const { jsPDF } = await import("jspdf");
  buildReportPdf(jsPDF, options).save(`${filename}.pdf`);
}
