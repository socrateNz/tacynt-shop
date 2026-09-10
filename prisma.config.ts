import { defineConfig, env } from "prisma/config";

// Prisma 7 ne charge plus .env automatiquement avant d'évaluer ce fichier.
// En production (Docker), il n'y a pas de fichier .env — les variables sont
// injectées directement par docker-compose.prod.yml — donc ENOENT ici est
// attendu, pas une erreur : seule cette cause précise est avalée.
try {
  process.loadEnvFile();
} catch (error) {
  if (!(error instanceof Error) || (error as NodeJS.ErrnoException).code !== "ENOENT") {
    throw error;
  }
}

// Migrate/Studio lisent la connexion ici (rôle propriétaire des migrations,
// DATABASE_URL). Le runtime applicatif ne passe jamais par ce fichier — voir
// lib/db/client.ts (adapter pg sur RUNTIME_DATABASE_URL).
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
