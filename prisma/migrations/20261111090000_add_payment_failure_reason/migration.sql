-- AlterTable
ALTER TABLE "online_order_payments" ADD COLUMN     "code_echec" TEXT,
ADD COLUMN     "reference_marchand" TEXT;

-- AlterTable
ALTER TABLE "laundry_payments" ADD COLUMN     "code_echec" TEXT,
ADD COLUMN     "reference_marchand" TEXT;

-- CreateIndex
CREATE INDEX "online_order_payments_reference_marchand_idx" ON "online_order_payments"("reference_marchand");

-- CreateIndex
CREATE INDEX "laundry_payments_reference_marchand_idx" ON "laundry_payments"("reference_marchand");


-- Reprise : référence marchand des paiements existants, telle qu'envoyée à
-- Codees ("{slug}-{numero}"), pour que le webhook les retrouve.
UPDATE "online_order_payments" p
SET "reference_marchand" = o."slug" || '-' || oo."numero"
FROM "online_orders" oo
JOIN "organizations" o ON o."id" = oo."organization_id"
WHERE p."online_order_id" = oo."id" AND p."reference_marchand" IS NULL;

UPDATE "laundry_payments" p
SET "reference_marchand" = o."slug" || '-' || lo."numero"
FROM "laundry_orders" lo
JOIN "organizations" o ON o."id" = lo."organization_id"
WHERE p."laundry_order_id" = lo."id" AND p."reference_marchand" IS NULL;
