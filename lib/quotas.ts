import type { Prisma } from "@prisma/client";

// Quotas section 9.1 (table complète des 4 plans). "Illimité" = Infinity,
// compatible avec la comparaison count >= limit ci-dessous sans cas
// particulier. Seule la ligne "Historique" du tableau n'est pas reprise ici
// (Phase 3, M24) : purger des données selon un plan est une opération
// destructrice, hors périmètre tant qu'aucun signal explicite ne la demande.
const STARTER_LIMITS = {
  shops: 1,
  registers: 1,
  users: 2,
  products: 300,
} as const;

type QuotaResource = keyof typeof STARTER_LIMITS;

const LIMITS_BY_PLAN: Record<string, Record<QuotaResource, number>> = {
  STARTER: STARTER_LIMITS,
  BUSINESS: {
    shops: 1,
    registers: 3,
    users: 8,
    products: Infinity,
  },
  PRO: {
    shops: 5,
    registers: 10,
    users: 30,
    products: Infinity,
  },
  ENTERPRISE: {
    shops: Infinity,
    registers: Infinity,
    users: Infinity,
    products: Infinity,
  },
};

export class QuotaExceededError extends Error {
  constructor(
    public readonly resource: QuotaResource,
    public readonly limit: number,
  ) {
    super(
      `Quota "${resource}" atteint (limite : ${limit}). Passez à un plan supérieur pour continuer.`,
    );
    this.name = "QuotaExceededError";
  }
}

// Vérifié côté serveur à chaque création d'entité concernée (section 9.3).
// Un dépassement doit déclencher une invitation à monter de plan côté
// appelant — jamais une perte de données ni un blocage de l'existant.
export async function assertWithinQuota(
  tx: Prisma.TransactionClient,
  organizationId: string,
  plan: string,
  resource: QuotaResource,
): Promise<void> {
  const limit = (LIMITS_BY_PLAN[plan] ?? STARTER_LIMITS)[resource];

  const count = await {
    shops: () => tx.shop.count({ where: { organizationId } }),
    registers: () => tx.register.count({ where: { shop: { organizationId } } }),
    users: () => tx.user.count({ where: { organizationId } }),
    products: () => tx.product.count({ where: { organizationId } }),
  }[resource]();

  if (count >= limit) {
    throw new QuotaExceededError(resource, limit);
  }
}
