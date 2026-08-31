import type { Prisma } from "@prisma/client";

// Quotas section 9.1. Business/Pro/Enterprise arrivent avec la facturation
// SaaS complète (Phase 3) — seul STARTER est appliqué pour l'instant, les
// autres plans retombent dessus par défaut plutôt que de bloquer sans raison.
const STARTER_LIMITS = {
  shops: 1,
  registers: 1,
  users: 2,
  products: 300,
} as const;

type QuotaResource = keyof typeof STARTER_LIMITS;

const LIMITS_BY_PLAN: Record<string, Record<QuotaResource, number>> = {
  STARTER: STARTER_LIMITS,
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
