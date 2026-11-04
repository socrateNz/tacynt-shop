-- AlterTable
ALTER TABLE "online_orders" ADD COLUMN     "marketplace_customer_id" UUID;

-- AlterTable
ALTER TABLE "rental_contracts" ADD COLUMN     "marketplace_customer_id" UUID;

-- CreateTable
CREATE TABLE "marketplace_customers" (
    "id" UUID NOT NULL,
    "nom" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "email_verified_at" TIMESTAMP(3),
    "verification_code_hash" TEXT,
    "verification_code_expires_at" TIMESTAMP(3),
    "verification_code_sent_at" TIMESTAMP(3),
    "verification_attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_sessions" (
    "id" UUID NOT NULL,
    "marketplace_customer_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_customers_email_key" ON "marketplace_customers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_sessions_token_hash_key" ON "marketplace_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "marketplace_sessions_marketplace_customer_id_idx" ON "marketplace_sessions"("marketplace_customer_id");

-- CreateIndex
CREATE INDEX "online_orders_marketplace_customer_id_idx" ON "online_orders"("marketplace_customer_id");

-- CreateIndex
CREATE INDEX "rental_contracts_marketplace_customer_id_idx" ON "rental_contracts"("marketplace_customer_id");

-- AddForeignKey
ALTER TABLE "online_orders" ADD CONSTRAINT "online_orders_marketplace_customer_id_fkey" FOREIGN KEY ("marketplace_customer_id") REFERENCES "marketplace_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_contracts" ADD CONSTRAINT "rental_contracts_marketplace_customer_id_fkey" FOREIGN KEY ("marketplace_customer_id") REFERENCES "marketplace_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_sessions" ADD CONSTRAINT "marketplace_sessions_marketplace_customer_id_fkey" FOREIGN KEY ("marketplace_customer_id") REFERENCES "marketplace_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- Comptes clients Sodu : PAS des tables tenant (un compte commande auprès de
-- plusieurs organisations) — aucune policy RLS, et tacynt_app n'y a
-- STRICTEMENT AUCUN accès malgré ALTER DEFAULT PRIVILEGES
-- (prisma/rls-manifest.sql). Seul lib/db/marketplace-client.ts (rôle
-- propriétaire) y touche, même modèle que platform_admins.
REVOKE ALL ON "marketplace_customers" FROM tacynt_app;
REVOKE ALL ON "marketplace_sessions" FROM tacynt_app;
