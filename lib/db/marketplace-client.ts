import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const globalForMarketplacePrisma = globalThis as unknown as {
  marketplacePrisma?: PrismaClient;
};

// Rôle propriétaire des migrations (DATABASE_URL) — le SEUL point d'accès
// autorisé à marketplace_customers/marketplace_sessions (comptes clients de
// l'app mobile Sodu). Même principe que lib/db/platform-client.ts : distinct
// par convention de nommage, tacynt_app n'a de toute façon physiquement
// aucun droit sur ces tables (REVOKE dans la migration, voir
// prisma/rls-manifest.sql).
export const marketplacePrisma =
  globalForMarketplacePrisma.marketplacePrisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

if (process.env.NODE_ENV !== "production") {
  globalForMarketplacePrisma.marketplacePrisma = marketplacePrisma;
}
