-- CreateEnum
CREATE TYPE "serial_number_status" AS ENUM ('EN_STOCK', 'VENDU');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "suivi_serie" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "serial_numbers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "numero" TEXT NOT NULL,
    "statut" "serial_number_status" NOT NULL DEFAULT 'EN_STOCK',
    "sale_line_id" UUID,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sold_at" TIMESTAMP(3),

    CONSTRAINT "serial_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "serial_numbers_organization_id_idx" ON "serial_numbers"("organization_id");

-- CreateIndex
CREATE INDEX "serial_numbers_shop_id_idx" ON "serial_numbers"("shop_id");

-- CreateIndex
CREATE INDEX "serial_numbers_variant_id_shop_id_statut_idx" ON "serial_numbers"("variant_id", "shop_id", "statut");

-- CreateIndex
CREATE UNIQUE INDEX "serial_numbers_organization_id_numero_key" ON "serial_numbers"("organization_id", "numero");

-- AddForeignKey
ALTER TABLE "serial_numbers" ADD CONSTRAINT "serial_numbers_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serial_numbers" ADD CONSTRAINT "serial_numbers_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serial_numbers" ADD CONSTRAINT "serial_numbers_sale_line_id_fkey" FOREIGN KEY ("sale_line_id") REFERENCES "sale_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS : serial_numbers dépend d'une boutique, même groupe que lots/shop_prices/stock_levels.
ALTER TABLE "serial_numbers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "serial_numbers" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "serial_numbers";
CREATE POLICY tenant_isolation ON "serial_numbers"
  USING (
    organization_id = app_current_tenant_id()
    AND (app_current_shop_id() IS NULL OR shop_id = app_current_shop_id())
  )
  WITH CHECK (
    organization_id = app_current_tenant_id()
    AND (app_current_shop_id() IS NULL OR shop_id = app_current_shop_id())
  );

GRANT SELECT, INSERT, UPDATE ON "serial_numbers" TO tacynt_app;
