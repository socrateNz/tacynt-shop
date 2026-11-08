-- AlterTable
ALTER TABLE "shops" ADD COLUMN     "livraison_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "livraison_gratuite_active" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "montant_livraison_gratuite" DECIMAL(14,2);

-- AlterTable
ALTER TABLE "online_orders" ADD COLUMN     "frais_livraison" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "delivery_zones" ADD COLUMN     "frais" DECIMAL(12,2) NOT NULL DEFAULT 0;

