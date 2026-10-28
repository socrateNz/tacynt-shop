-- AlterTable
ALTER TABLE "online_orders" ADD COLUMN     "emballage_prix_unitaire" DECIMAL(12,2),
ADD COLUMN     "emballage_quantite" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "prix_emballage" DECIMAL(12,2);
