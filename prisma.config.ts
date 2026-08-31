import { defineConfig, env } from "prisma/config";

// Prisma 7 ne charge plus .env automatiquement avant d'évaluer ce fichier.
process.loadEnvFile();

// Migrate/Studio lisent la connexion ici (rôle propriétaire des migrations,
// DATABASE_URL). Le runtime applicatif ne passe jamais par ce fichier — voir
// lib/db/client.ts (adapter pg sur RUNTIME_DATABASE_URL).
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
