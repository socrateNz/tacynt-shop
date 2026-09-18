import type { Prisma } from "@prisma/client";

import { shopScope } from "./scope";

export type DashboardOverview = {
  chiffreAffaires: number;
  nombreVentes: number;
  panierMoyen: number;
  salesByDay: { date: string; total: number }[];
  topProducts: {
    productId: string;
    designation: string;
    coverImageId: string | null;
    quantiteVendue: number;
    chiffreAffaires: number;
  }[];
  recentSales: {
    id: string;
    numero: string;
    customerNom: string | null;
    nombreArticles: number;
    totalTtc: number;
    modePaiement: string;
    createdAt: Date;
  }[];
};

const CHART_DAYS = 14;
const TOP_PRODUCTS_LIMIT = 5;
const RECENT_SALES_LIMIT = 8;

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Toujours en UTC (Date.UTC, jamais setHours/setDate en heure locale) : les
// clés du graphique viennent de dayKey (UTC, via toISOString). Un serveur
// dont le fuseau local n'est pas UTC (ex. déploiement en Afrique de l'Ouest,
// UTC+1) déciderait autrement d'une frontière de "minuit" différente de
// celle utilisée pour générer les clés, décalant silencieusement chaque
// bucket d'un jour — bug réel constaté en testant ce fichier.
function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

// Tableau de bord admin (M32) : une seule requête (fenêtre de `days` jours),
// réduite en JS pour nourrir les 4 panneaux — même patron "findMany puis
// réduction" que lib/reports/daily.ts, pas de groupBy/SQL brut inédit.
// Agrégation "produits les plus vendus" dédiée ici plutôt que réutilisée
// depuis getRotationReport (lib/reports/rotation.ts) : ce dernier ne
// retourne ni productId ni indicateur d'image (nécessaires pour la
// vignette), et porte le coût d'une requête stockLevels supplémentaire
// (dormants/tauxRotation) inutile pour ce panneau.
export async function getDashboardOverview(
  tx: Prisma.TransactionClient,
  shopId: string,
  days = 30,
): Promise<DashboardOverview> {
  const now = new Date();
  const from = addUtcDays(startOfUtcDay(now), -days);

  const sales = await tx.sale.findMany({
    where: { ...shopScope(shopId), statut: "VALIDEE", createdAt: { gte: from } },
    include: {
      lines: {
        include: {
          variant: {
            include: {
              product: {
                include: { images: { select: { id: true }, orderBy: { position: "asc" }, take: 1 } },
              },
            },
          },
        },
      },
      payments: true,
      customer: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const chiffreAffaires = sales.reduce((sum, s) => sum + Number(s.totalTtc), 0);
  const nombreVentes = sales.length;
  const panierMoyen = nombreVentes > 0 ? chiffreAffaires / nombreVentes : 0;

  // Graphique : les CHART_DAYS derniers jours, agrégés depuis les mêmes
  // lignes que ci-dessus (pas de requête séparée) — jours sans vente
  // pré-remplis à 0 pour un tracé continu.
  const chartFrom = addUtcDays(startOfUtcDay(now), -(CHART_DAYS - 1));

  const buckets = new Map<string, number>();
  for (let i = 0; i < CHART_DAYS; i++) {
    buckets.set(dayKey(addUtcDays(chartFrom, i)), 0);
  }
  for (const s of sales) {
    const key = dayKey(s.createdAt);
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + Number(s.totalTtc));
    }
  }
  const salesByDay = [...buckets.entries()].map(([date, total]) => ({ date, total }));

  const productAgg = new Map<
    string,
    { designation: string; coverImageId: string | null; quantite: number; revenue: number }
  >();
  for (const s of sales) {
    for (const l of s.lines) {
      const p = l.variant.product;
      const entry = productAgg.get(p.id) ?? {
        designation: p.designation,
        coverImageId: p.images[0]?.id ?? null,
        quantite: 0,
        revenue: 0,
      };
      entry.quantite += Number(l.quantite);
      entry.revenue += Number(l.prixUnitaire) * Number(l.quantite) - Number(l.remise);
      productAgg.set(p.id, entry);
    }
  }
  const topProducts = [...productAgg.entries()]
    .map(([productId, v]) => ({
      productId,
      designation: v.designation,
      coverImageId: v.coverImageId,
      quantiteVendue: v.quantite,
      chiffreAffaires: v.revenue,
    }))
    .sort((a, b) => b.quantiteVendue - a.quantiteVendue)
    .slice(0, TOP_PRODUCTS_LIMIT);

  const recentSales = sales.slice(0, RECENT_SALES_LIMIT).map((s) => ({
    id: s.id,
    numero: s.numero,
    customerNom: s.customer?.nom ?? null,
    nombreArticles: s.lines.length,
    totalTtc: Number(s.totalTtc),
    modePaiement: s.payments[0]?.mode ?? "—",
    createdAt: s.createdAt,
  }));

  return { chiffreAffaires, nombreVentes, panierMoyen, salesByDay, topProducts, recentSales };
}
