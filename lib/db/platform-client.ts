import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const globalForPlatformPrisma = globalThis as unknown as {
  platformPrisma?: PrismaClient;
};

// Rôle propriétaire des migrations (DATABASE_URL) — le SEUL point d'accès
// autorisé à platform_admins/platform_admin_sessions/platform_payments
// (Phase 3, M25). Distinct de systemPrisma par convention de nommage
// plutôt que par connexion réelle (même rôle sous le capot) : l'intention
// est qu'aucun code ne touche ces trois tables via systemPrisma ou le
// client tenant — seulement via ce fichier. tacynt_app (le rôle runtime
// applicatif) n'a de toute façon physiquement aucun droit dessus (REVOKE
// dans la migration, voir prisma/rls-manifest.sql).
export const platformPrisma =
  globalForPlatformPrisma.platformPrisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

if (process.env.NODE_ENV !== "production") {
  globalForPlatformPrisma.platformPrisma = platformPrisma;
}
