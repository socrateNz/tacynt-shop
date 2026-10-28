/*
  Warnings:

  - You are about to drop the column `unite` on the `products` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "unite" TEXT NOT NULL DEFAULT 'piece',
ADD COLUMN     "unite_quantite" DECIMAL(10,3) NOT NULL DEFAULT 1;

-- Backfill : chaque variante hérite du type d'unité de son produit avant que
-- la colonne produit ne soit supprimée (uniteQuantite reste à 1, valeur
-- neutre par défaut — aucune quantité n'existait avant cette migration).
UPDATE "product_variants" pv
SET "unite" = p."unite"
FROM "products" p
WHERE pv."product_id" = p."id";

-- AlterTable
ALTER TABLE "products" DROP COLUMN "unite";
