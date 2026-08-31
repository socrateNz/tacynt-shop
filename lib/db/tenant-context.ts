import type { Prisma } from "@prisma/client";

import { prisma } from "./client";
import { systemPrisma } from "./system-client";

type TenantContext = {
  organizationId: string;
  shopId?: string;
};

// Ouvre une transaction sur le rôle applicatif (soumis à RLS) et positionne
// les variables de session lues par les policies Postgres (voir
// prisma/rls-manifest.sql). set_config(..., true) est local à la
// transaction : il s'annule tout seul au commit/rollback, donc sûr avec le
// pool de connexions de Prisma.
export async function withTenantContext<T>(
  ctx: TenantContext,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${ctx.organizationId}, true)`;
    if (ctx.shopId) {
      await tx.$executeRaw`SELECT set_config('app.shop_id', ${ctx.shopId}, true)`;
    }
    return fn(tx);
  });
}

// Rôle propriétaire, sans set_config : réservé au bootstrap d'inscription
// et aux scripts système. Voir lib/db/system-client.ts.
export async function withSystemContext<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return systemPrisma.$transaction((tx) => fn(tx));
}
