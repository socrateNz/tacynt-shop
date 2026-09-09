import type { Prisma } from "@prisma/client";

import { shopScope } from "./scope";

export type TresorerieReport = {
  encaissementsParMode: { mode: string; montant: number }[];
  totalEncaissements: number;
  depensesParCategorie: { categorie: string; montant: number }[];
  totalDepenses: number;
  soldeNet: number;
};

// "Encaissements, dépenses, solde net par période" (section 5.7). Contexte
// comptable (destiné au comptable, différent du rapprochement de caisse
// physique de sessions/[id]/close) : seules les dépenses VALIDEE comptent
// ici — une dépense EN_ATTENTE n'est pas encore reconnue comme charge
// légitime, contrairement au rapprochement de tiroir-caisse qui doit lui
// compter tout l'argent physiquement sorti quel que soit son statut.
export async function getTresorerieReport(
  tx: Prisma.TransactionClient,
  shopId: string | null,
  from: Date,
  to: Date,
): Promise<TresorerieReport> {
  const [payments, expenses] = await Promise.all([
    tx.payment.findMany({
      where: { ...shopScope(shopId), sale: { statut: "VALIDEE", createdAt: { gte: from, lt: to } } },
    }),
    tx.expense.findMany({
      where: { ...shopScope(shopId), statut: "VALIDEE", createdAt: { gte: from, lt: to } },
    }),
  ]);

  const parModeMap = new Map<string, number>();
  for (const p of payments) {
    parModeMap.set(p.mode, (parModeMap.get(p.mode) ?? 0) + Number(p.montant));
  }

  const parCategorieMap = new Map<string, number>();
  for (const e of expenses) {
    parCategorieMap.set(e.categorie, (parCategorieMap.get(e.categorie) ?? 0) + Number(e.montant));
  }

  const totalEncaissements = [...parModeMap.values()].reduce((s, v) => s + v, 0);
  const totalDepenses = [...parCategorieMap.values()].reduce((s, v) => s + v, 0);

  return {
    encaissementsParMode: [...parModeMap.entries()]
      .map(([mode, montant]) => ({ mode, montant }))
      .sort((a, b) => b.montant - a.montant),
    totalEncaissements,
    depensesParCategorie: [...parCategorieMap.entries()]
      .map(([categorie, montant]) => ({ categorie, montant }))
      .sort((a, b) => b.montant - a.montant),
    totalDepenses,
    soldeNet: totalEncaissements - totalDepenses,
  };
}
