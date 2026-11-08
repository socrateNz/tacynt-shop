-- AlterTable
ALTER TABLE "online_orders" ADD COLUMN     "delivery_zone_id" UUID,
ADD COLUMN     "lieu_dit" TEXT,
ADD COLUMN     "zone_livraison_nom" TEXT;

-- CreateTable
CREATE TABLE "delivery_zones" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "nom" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_zones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "delivery_zones_organization_id_idx" ON "delivery_zones"("organization_id");

-- CreateIndex
CREATE INDEX "delivery_zones_shop_id_idx" ON "delivery_zones"("shop_id");

-- AddForeignKey
ALTER TABLE "online_orders" ADD CONSTRAINT "online_orders_delivery_zone_id_fkey" FOREIGN KEY ("delivery_zone_id") REFERENCES "delivery_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_zones" ADD CONSTRAINT "delivery_zones_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_zones" ADD CONSTRAINT "delivery_zones_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- RLS : table scopée boutique, même groupe/prédicat que rental_units et
-- online_orders (prisma/rls-manifest.sql).
ALTER TABLE "delivery_zones" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "delivery_zones" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "delivery_zones";
CREATE POLICY tenant_isolation ON "delivery_zones"
  USING (
    organization_id = app_current_tenant_id()
    AND (app_current_shop_id() IS NULL OR shop_id = app_current_shop_id())
  )
  WITH CHECK (
    organization_id = app_current_tenant_id()
    AND (app_current_shop_id() IS NULL OR shop_id = app_current_shop_id())
  );

-- Jamais de DELETE : une zone se désactive (actif = false).
GRANT SELECT, INSERT, UPDATE ON "delivery_zones" TO tacynt_app;
