-- AlterTable: id added nullable first, backfilled, then enforced — a
-- plain "NOT NULL" add would fail on any existing row (production already
-- has real product photos from the single-image feature this replaces).
ALTER TABLE "product_images" ADD COLUMN     "id" UUID;
ALTER TABLE "product_images" ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

UPDATE "product_images" SET "id" = gen_random_uuid() WHERE "id" IS NULL;

ALTER TABLE "product_images" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "product_images" DROP CONSTRAINT "product_images_pkey";
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE INDEX "product_images_product_id_idx" ON "product_images"("product_id");

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "description" TEXT;
