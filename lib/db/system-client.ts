import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const globalForSystemPrisma = globalThis as unknown as {
  systemPrisma?: PrismaClient;
};

// Rôle propriétaire des migrations — bypass RLS. Réservé au bootstrap
// d'inscription (création d'organisation) et aux scripts de maintenance
// (scripts/reconstruct-stock.ts). Ne jamais utiliser ce client pour
// répondre à une requête utilisateur authentifiée.
export const systemPrisma =
  globalForSystemPrisma.systemPrisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

if (process.env.NODE_ENV !== "production") {
  globalForSystemPrisma.systemPrisma = systemPrisma;
}
