import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Rôle applicatif runtime (tacynt_app) — non-owner, soumis à RLS. Toute
// requête tenant-scopée doit passer par withTenantContext() sur ce client,
// jamais par systemPrisma (lib/db/system-client.ts). Prisma 7 exige un
// adapter explicite (plus de `datasources.db.url`).
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.RUNTIME_DATABASE_URL }),
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
