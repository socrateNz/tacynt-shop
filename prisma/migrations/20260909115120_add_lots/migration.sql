-- AlterTable
ALTER TABLE "products" ADD COLUMN     "suivi_lots" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN     "lot_id" UUID;

-- CreateTable
CREATE TABLE "lots" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "numero" TEXT NOT NULL,
    "date_peremption" TIMESTAMP(3),
    "quantite" DECIMAL(14,3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lots_organization_id_idx" ON "lots"("organization_id");

-- CreateIndex
CREATE INDEX "lots_shop_id_idx" ON "lots"("shop_id");

-- CreateIndex
CREATE UNIQUE INDEX "lots_variant_id_shop_id_numero_key" ON "lots"("variant_id", "shop_id", "numero");

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS : lots dépend d'une boutique, même groupe que shop_prices/stock_levels.
ALTER TABLE "lots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lots" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "lots";
CREATE POLICY tenant_isolation ON "lots"
  USING (
    organization_id = app_current_tenant_id()
    AND (app_current_shop_id() IS NULL OR shop_id = app_current_shop_id())
  )
  WITH CHECK (
    organization_id = app_current_tenant_id()
    AND (app_current_shop_id() IS NULL OR shop_id = app_current_shop_id())
  );

GRANT SELECT, INSERT, UPDATE ON "lots" TO tacynt_app;
