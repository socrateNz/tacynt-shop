import type { Prisma } from "@prisma/client";

import type { AccountingMapping } from "./accounting-mapping";
import { shopScope } from "./scope";

export type JournalLine = {
  date: string;
  piece: string;
  compteDebit: string;
  compteCredit: string;
  montant: number;
  libelle: string;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Connecteur comptable (Phase 4, M28) : export uniquement, jamais une
// nouvelle source de vérité (décision verrouillée #10) — chaque ligne est
// une écriture DÉJÀ équilibrée (compte débit + compte crédit + un seul
// montant, décision #12), pas le format traditionnel à deux lignes
// séparées : plus simple à vérifier (somme débit = somme crédit trivialement
// par construction) et lisible par n'importe quel logiciel acceptant un
// import générique.
export async function getAccountingJournal(
  tx: Prisma.TransactionClient,
  shopId: string | null,
  from: Date,
  to: Date,
  mapping: AccountingMapping,
): Promise<JournalLine[]> {
  const lines: JournalLine[] = [];

  const sales = await tx.sale.findMany({
    where: { ...shopScope(shopId), statut: "VALIDEE", createdAt: { gte: from, lt: to } },
    include: { payments: true },
    orderBy: { createdAt: "asc" },
  });

  for (const sale of sales) {
    const totalTtc = Number(sale.totalTtc);
    if (totalTtc === 0 || sale.payments.length === 0) continue;

    const totalHt = Number(sale.totalHt);
    const totalTaxe = Number(sale.totalTaxe);
    const dateStr = sale.createdAt.toISOString().slice(0, 10);
    const piece = `VENTE-${sale.numero}`;

    // Répartition du HT/TVA au prorata de chaque paiement (vente scindée
    // sur plusieurs modes) — le dernier paiement absorbe le reliquat
    // d'arrondi plutôt que de laisser dériver la somme au centime près.
    let allocatedHt = 0;
    let allocatedTaxe = 0;

    sale.payments.forEach((payment, index) => {
      const isLast = index === sale.payments.length - 1;
      const montantPaiement = Number(payment.montant);
      let htPart: number;
      let taxePart: number;

      if (isLast) {
        htPart = round2(totalHt - allocatedHt);
        taxePart = round2(totalTaxe - allocatedTaxe);
      } else {
        const ratio = montantPaiement / totalTtc;
        htPart = round2(totalHt * ratio);
        taxePart = round2(totalTaxe * ratio);
        allocatedHt += htPart;
        allocatedTaxe += taxePart;
      }

      const compteDebit = mapping.paiementComptes[payment.mode];

      if (htPart !== 0) {
        lines.push({
          date: dateStr,
          piece,
          compteDebit,
          compteCredit: mapping.ventesCompte,
          montant: htPart,
          libelle: `Vente ${sale.numero}`,
        });
      }
      if (taxePart !== 0) {
        lines.push({
          date: dateStr,
          piece,
          compteDebit,
          compteCredit: mapping.tvaCompte,
          montant: taxePart,
          libelle: `TVA vente ${sale.numero}`,
        });
      }
    });
  }

  // customer_ledger/supplier_ledger sont hors périmètre v1 (aucun
  // modePaiement porté par ces journaux, décision verrouillée) — seules les
  // dépenses réellement encaissées (statut VALIDEE) sont mappées ici.
  const expenses = await tx.expense.findMany({
    where: { ...shopScope(shopId), statut: "VALIDEE", createdAt: { gte: from, lt: to } },
    orderBy: { createdAt: "asc" },
  });

  for (const expense of expenses) {
    const montant = Number(expense.montant);
    if (montant === 0) continue;

    lines.push({
      date: expense.createdAt.toISOString().slice(0, 10),
      piece: `DEPENSE-${expense.id.slice(0, 8)}`,
      compteDebit: mapping.chargesCompteParDefaut,
      compteCredit: mapping.paiementComptes[expense.modePaiement],
      montant,
      libelle: `Dépense ${expense.categorie}`,
    });
  }

  return lines.sort((a, b) => a.date.localeCompare(b.date));
}
