// Filet de sécurité pour les paiements Codees abandonnés (client qui ferme
// l'onglet sans jamais revenir sur /merci/[orderId], donc jamais rejoué par
// le polling du front) — aucun autre mécanisme de ce projet ne les
// atteindrait jamais. Cross-organisations comme scripts/reconstruct-stock.ts :
// ce qu'aucune requête applicative normale ne doit jamais faire.
//
// Usage : npx tsx scripts/expire-abandoned-payments.ts
// Pensé pour un timer systemd périodique (voir docs/deployment.md) — pas
// encore câblé automatiquement, à faire au déploiement.
try {
  process.loadEnvFile();
} catch (error) {
  if (!(error instanceof Error) || (error as NodeJS.ErrnoException).code !== "ENOENT") {
    throw error;
  }
}

// Import dynamique, APRÈS loadEnvFile() : lib/db/system-client.ts lit
// process.env.DATABASE_URL à son propre chargement de module — un import
// statique serait hoisté avant ce loadEnvFile() (comportement ESM), donc
// lu avant que les variables existent (bug constaté : "client password
// must be a string").
async function main() {
  const { systemPrisma } = await import("@/lib/db/system-client");
  const { verifyAndApplyPayment } = await import("@/lib/payments/service");

  const abandoned = await systemPrisma.onlineOrderPayment.findMany({
    where: {
      statut: { in: ["INITIE", "EN_ATTENTE"] },
      expiresAt: { lt: new Date() },
    },
    select: { id: true, organizationId: true, shopId: true },
  });

  let traites = 0;
  for (const payment of abandoned) {
    try {
      await verifyAndApplyPayment(
        { organizationId: payment.organizationId, shopId: payment.shopId },
        payment.id,
      );
      traites += 1;
    } catch (error) {
      console.error(`Échec pour le paiement ${payment.id} :`, error);
    }
  }

  console.log(`${traites}/${abandoned.length} paiement(s) abandonné(s) traité(s).`);
  await systemPrisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
