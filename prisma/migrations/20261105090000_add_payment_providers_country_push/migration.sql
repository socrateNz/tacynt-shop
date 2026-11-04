-- CreateEnum
CREATE TYPE "payment_provider" AS ENUM ('CODEES', 'STRIPE');

-- CreateEnum
CREATE TYPE "online_order_payment_mode" AS ENUM ('RECEPTION', 'EN_LIGNE');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "pays" TEXT NOT NULL DEFAULT 'CM';

-- AlterTable
ALTER TABLE "shops" ADD COLUMN     "paiement_reception_actif" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "online_orders" ADD COLUMN     "mode_paiement" "online_order_payment_mode" NOT NULL DEFAULT 'RECEPTION';

-- AlterTable
ALTER TABLE "online_order_payments" ADD COLUMN     "fournisseur" "payment_provider" NOT NULL DEFAULT 'CODEES';

-- CreateTable
CREATE TABLE "marketplace_push_tokens" (
    "id" UUID NOT NULL,
    "marketplace_customer_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disabled_at" TIMESTAMP(3),

    CONSTRAINT "marketplace_push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_push_tokens_token_key" ON "marketplace_push_tokens"("token");

-- CreateIndex
CREATE INDEX "marketplace_push_tokens_marketplace_customer_id_idx" ON "marketplace_push_tokens"("marketplace_customer_id");

-- AddForeignKey
ALTER TABLE "marketplace_push_tokens" ADD CONSTRAINT "marketplace_push_tokens_marketplace_customer_id_fkey" FOREIGN KEY ("marketplace_customer_id") REFERENCES "marketplace_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Appareils push des clients Sodu : même isolation que marketplace_customers
-- (aucun accès tacynt_app, seul lib/db/marketplace-client.ts y touche).
REVOKE ALL ON "marketplace_push_tokens" FROM tacynt_app;
