import type { Prisma } from "@prisma/client";

export type CreancesReport = {
  totalDu: number;
  parTranche: { tranche: string; montant: number }[];
  parClient: {
    customerId: string;
    nom: string;
    solde: number;
    j0_30: number;
    j31_60: number;
    j61_90: number;
    j90Plus: number;
  }[];
};

const TRANCHES = ["0-30j", "31-60j", "61-90j", "90j+"] as const;

function bucketFor(ageDays: number): (typeof TRANCHES)[number] {
  if (ageDays <= 30) return "0-30j";
  if (ageDays <= 60) return "31-60j";
  if (ageDays <= 90) return "61-90j";
  return "90j+";
}

// "Balance âgée des ardoises clients" (section 5.7) : instantané au moment
// présent, pas filtré par période (une dette n'a qu'un seul âge courant).
// Algorithme FIFO : chaque vente à crédit ouvre une dette datée ; chaque
// paiement/avoir consomme les dettes les plus anciennes en premier — c'est
// ce qui donne un âge correct à la portion encore due, pas juste l'âge de
// la dernière écriture du journal.
export async function getCreancesReport(
  tx: Prisma.TransactionClient,
  organizationId: string,
): Promise<CreancesReport> {
  const customers = await tx.customer.findMany({ where: { organizationId } });
  const now = Date.now();

  const parClient: CreancesReport["parClient"] = [];
  const parTrancheMap = new Map<string, number>(TRANCHES.map((t) => [t, 0]));
  let totalDu = 0;

  for (const customer of customers) {
    const entries = await tx.customerLedger.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: "asc" },
    });

    const openDebts: { date: Date; remaining: number }[] = [];
    for (const entry of entries) {
      const montant = Number(entry.montant);
      if (montant > 0) {
        openDebts.push({ date: entry.createdAt, remaining: montant });
        continue;
      }
      // Montant négatif (paiement/avoir/annulation) : consomme les dettes
      // ouvertes les plus anciennes en premier.
      let toConsume = -montant;
      for (const debt of openDebts) {
        if (toConsume <= 0) break;
        const consumed = Math.min(debt.remaining, toConsume);
        debt.remaining -= consumed;
        toConsume -= consumed;
      }
    }

    const buckets = { j0_30: 0, j31_60: 0, j61_90: 0, j90Plus: 0 };
    let solde = 0;
    for (const debt of openDebts) {
      if (debt.remaining <= 0) continue;
      solde += debt.remaining;
      const ageDays = Math.floor((now - debt.date.getTime()) / (24 * 60 * 60 * 1000));
      const bucket = bucketFor(ageDays);
      parTrancheMap.set(bucket, (parTrancheMap.get(bucket) ?? 0) + debt.remaining);
      if (bucket === "0-30j") buckets.j0_30 += debt.remaining;
      else if (bucket === "31-60j") buckets.j31_60 += debt.remaining;
      else if (bucket === "61-90j") buckets.j61_90 += debt.remaining;
      else buckets.j90Plus += debt.remaining;
    }

    if (solde > 0.005) {
      totalDu += solde;
      parClient.push({ customerId: customer.id, nom: customer.nom, solde, ...buckets });
    }
  }

  return {
    totalDu,
    parTranche: TRANCHES.map((tranche) => ({ tranche, montant: parTrancheMap.get(tranche) ?? 0 })),
    parClient: parClient.sort((a, b) => b.solde - a.solde),
  };
}
