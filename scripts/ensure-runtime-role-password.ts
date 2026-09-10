// Aligne le mot de passe réel des rôles Postgres (tacynt_owner, tacynt_app)
// sur celui déjà présent dans DATABASE_URL/RUNTIME_DATABASE_URL — la toute
// première migration (prisma/migrations/20260830173210_rls_policies) crée
// tacynt_app avec un mot de passe de développement codé en dur ; on ne
// touche jamais à une migration déjà appliquée ailleurs, donc on corrige le
// mot de passe après coup, ici, plutôt que dans l'historique de migration.
// ALTER ROLE ... WITH PASSWORD est idempotent : sûr à relancer à chaque
// déploiement, même sans changement.
//
// Usage : npx tsx scripts/ensure-runtime-role-password.ts (après `prisma
// migrate deploy`, voir .github/workflows/deploy.yml)
//
// Pas de .env dans le conteneur Docker (exclu par .dockerignore) — les
// variables y viennent de docker-compose.prod.yml, jamais d'un fichier.
try {
  process.loadEnvFile();
} catch (error) {
  if (!(error instanceof Error) || (error as NodeJS.ErrnoException).code !== "ENOENT") {
    throw error;
  }
}

import { Client } from "pg";

function extractPassword(connectionString: string | undefined, varName: string): string {
  if (!connectionString) {
    throw new Error(`${varName} manquant.`);
  }
  const url = new URL(connectionString);
  if (!url.password) {
    throw new Error(`${varName} ne contient pas de mot de passe.`);
  }
  return decodeURIComponent(url.password);
}

// Les mots de passe viennent de variables d'environnement contrôlées côté
// serveur (jamais d'entrée utilisateur) — échappement standard des quotes
// appliqué par précaution, ALTER ROLE ne se prête pas de façon fiable à une
// requête paramétrée sur la position du mot de passe.
function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

async function main() {
  const ownerPassword = extractPassword(process.env.DATABASE_URL, "DATABASE_URL");
  const appPassword = extractPassword(process.env.RUNTIME_DATABASE_URL, "RUNTIME_DATABASE_URL");

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(`ALTER ROLE tacynt_owner WITH PASSWORD '${escapeSqlLiteral(ownerPassword)}'`);
    await client.query(`ALTER ROLE tacynt_app WITH PASSWORD '${escapeSqlLiteral(appPassword)}'`);
    console.log("Mots de passe tacynt_owner/tacynt_app alignés sur DATABASE_URL/RUNTIME_DATABASE_URL.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
