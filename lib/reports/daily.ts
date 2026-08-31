import type { Prisma } from "@prisma/client";

export type DailyReport = {
  caDuJour: number;
  nombreTickets: number;
  panierMoyen: number;
  margeBrute: number;
  especesEnCaisse: number;
  rupturesActives: number;
  caSemaineDerniere: number;
  variationPourcent: number | null;
};

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Tableau de bord opérationnel (section 5.7) : CA du jour, nombre de
// tickets, panier moyen, marge brute, espèces en caisse, ruptures actives,
// comparaison au même jour de la semaine précédente. Les rapports détaillés
// (marges/rotation filtrables) sont Phase 2 — ceci reste la vue du jour.
export async function getDailyReport(
  tx: Prisma.TransactionClient,
  shopId: string,
): Promise<DailyReport> {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const lastWeekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  const lastWeekEnd = new Date(todayEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [todaySales, lastWeekSales, openSessions, ruptures] = await Promise.all([
    tx.sale.findMany({
      where: { shopId, statut: "VALIDEE", createdAt: { gte: todayStart, lt: todayEnd } },
      include: { lines: true, payments: true },
    }),
    tx.sale.aggregate({
      where: { shopId, statut: "VALIDEE", createdAt: { gte: lastWeekStart, lt: lastWeekEnd } },
      _sum: { totalTtc: true },
    }),
    tx.cashSession.findMany({ where: { shopId, closedAt: null } }),
    tx.stockLevel.count({ where: { shopId, quantite: { lte: 0 } } }),
  ]);

  const caDuJour = todaySales.reduce((sum, s) => sum + Number(s.totalTtc), 0);
  const nombreTickets = todaySales.length;
  const panierMoyen = nombreTickets > 0 ? caDuJour / nombreTickets : 0;

  const margeBrute = todaySales.reduce(
    (sum, s) =>
      sum +
      s.lines.reduce(
        (lineSum, l) =>
          lineSum +
          (Number(l.prixUnitaire) * Number(l.quantite) -
            Number(l.remise) -
            Number(l.coutUnitaireFige) * Number(l.quantite)),
        0,
      ),
    0,
  );

  const especesTheoriquesOuvertes = openSessions.reduce((sum, session) => {
    const especesSession = todaySales
      .filter((s) => s.sessionId === session.id)
      .reduce(
        (sSum, s) =>
          sSum + s.payments.filter((p) => p.mode === "ESPECES").reduce((pSum, p) => pSum + Number(p.montant), 0),
        0,
      );
    return sum + Number(session.fondInitial) + especesSession;
  }, 0);

  const caSemaineDerniere = Number(lastWeekSales._sum.totalTtc ?? 0);
  const variationPourcent =
    caSemaineDerniere > 0 ? ((caDuJour - caSemaineDerniere) / caSemaineDerniere) * 100 : null;

  return {
    caDuJour,
    nombreTickets,
    panierMoyen,
    margeBrute,
    especesEnCaisse: especesTheoriquesOuvertes,
    rupturesActives: ruptures,
    caSemaineDerniere,
    variationPourcent,
  };
}
