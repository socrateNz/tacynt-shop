// Bootstrap d'un compte admin plateforme (Phase 3, M25) — il n'existe
// aucune inscription self-service pour /platform/login, contrairement aux
// organisations clientes : un opérateur Tacynt exécute ce script une fois.
//
// Usage : PLATFORM_ADMIN_EMAIL=... PLATFORM_ADMIN_PASSWORD=... npx tsx scripts/create-platform-admin.ts
//
// Rôle propriétaire des migrations, même connexion que lib/db/platform-client.ts
// mais un client Prisma construit ici plutôt qu'importé : les imports sont
// hoistés, importer le singleton avant process.loadEnvFile() le construirait
// avec DATABASE_URL encore undefined (piège déjà évité dans
// scripts/reconstruct-stock.ts de la même façon).
process.loadEnvFile();

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const email = process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.PLATFORM_ADMIN_PASSWORD;

  if (!email || !password || password.length < 8) {
    console.error(
      "Requis : PLATFORM_ADMIN_EMAIL et PLATFORM_ADMIN_PASSWORD (8 caractères min.) en variables d'environnement.",
    );
    process.exitCode = 1;
    return;
  }

  const passwordHash = await hash(password);

  const admin = await prisma.platformAdmin.upsert({
    where: { email },
    create: { email, hash: passwordHash },
    update: { hash: passwordHash, actif: true },
  });

  console.log(`Compte admin plateforme prêt : ${admin.email}`);
  await prisma.$disconnect();
}

main();
