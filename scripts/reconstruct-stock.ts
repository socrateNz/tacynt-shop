// Reconstruit intégralement stock_levels à partir de stock_movements.
// stock_levels n'est qu'une projection de performance, jamais la source de
// vérité — ce script est le garde-fou qui permet de corriger n'importe quel
// bug de projection sans perdre l'historique (cahier des charges section 10).
//
// Rôle système (bypass RLS) : ce script traite toutes les organisations en
// une passe, ce qu'aucune requête applicative normale ne doit jamais faire.
//
// Usage : npx tsx scripts/reconstruct-stock.ts

process.loadEnvFile();

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

type LevelKey = string;

type Level = {
  organizationId: string;
  shopId: string;
  variantId: string;
  quantite: number;
  cump: number;
};

function levelKey(shopId: string, variantId: string): LevelKey {
  return `${shopId}:${variantId}`;
}

async function main() {
  const movements = await prisma.stockMovement.findMany({
    orderBy: { createdAt: "asc" },
  });

  const levels = new Map<LevelKey, Level>();

  for (const movement of movements) {
    const key = levelKey(movement.shopId, movement.variantId);
    const current = levels.get(key) ?? {
      organizationId: movement.organizationId,
      shopId: movement.shopId,
      variantId: movement.variantId,
      quantite: 0,
      cump: 0,
    };

    const quantite = Number(movement.quantite); // signé : + entrée, - sortie
    const coutUnitaire = Number(movement.coutUnitaire);

    if (quantite > 0) {
      // CUMP = (stock_actuel × CUMP_actuel + qté_entrée × prix_entrée) / (stock_actuel + qté_entrée)
      const nouvelleQuantite = current.quantite + quantite;
      current.cump =
        nouvelleQuantite !== 0
          ? (current.quantite * current.cump + quantite * coutUnitaire) / nouvelleQuantite
          : current.cump;
      current.quantite = nouvelleQuantite;
    } else {
      // Sortie : le CUMP ne bouge jamais, seule la quantité diminue.
      current.quantite += quantite;
    }

    levels.set(key, current);
  }

  let written = 0;
  for (const level of levels.values()) {
    await prisma.stockLevel.upsert({
      where: { variantId_shopId: { variantId: level.variantId, shopId: level.shopId } },
      create: {
        organizationId: level.organizationId,
        variantId: level.variantId,
        shopId: level.shopId,
        quantite: level.quantite,
        cump: level.cump,
      },
      update: { quantite: level.quantite, cump: level.cump },
    });
    written += 1;
  }

  console.log(
    `Stock reconstruit : ${written} couple(s) boutique/variante à partir de ${movements.length} mouvement(s).`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
