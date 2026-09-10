-- CreateEnum
CREATE TYPE "online_order_status" AS ENUM ('EN_ATTENTE', 'CONFIRMEE', 'PRETE', 'RECUPEREE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "online_order_fulfillment_mode" AS ENUM ('RETRAIT_BOUTIQUE', 'LIVRAISON');

-- CreateTable
CREATE TABLE "online_orders" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "numero" TEXT NOT NULL,
    "customer_id" UUID,
    "nom_client" TEXT NOT NULL,
    "telephone_client" TEXT NOT NULL,
    "mode_retrait" "online_order_fulfillment_mode" NOT NULL DEFAULT 'RETRAIT_BOUTIQUE',
    "adresse_livraison" TEXT,
    "notes" TEXT,
    "statut" "online_order_status" NOT NULL DEFAULT 'EN_ATTENTE',
    "total_ht" DECIMAL(14,2) NOT NULL,
    "total_taxe" DECIMAL(14,2) NOT NULL,
    "total_ttc" DECIMAL(14,2) NOT NULL,
    "sale_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),

    CONSTRAINT "online_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "online_order_lines" (
    "organization_id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "online_order_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "quantite" DECIMAL(14,3) NOT NULL,
    "prix_unitaire" DECIMAL(12,2) NOT NULL,
    "remise" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "online_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "online_orders_sale_id_key" ON "online_orders"("sale_id");

-- CreateIndex
CREATE INDEX "online_orders_organization_id_idx" ON "online_orders"("organization_id");

-- CreateIndex
CREATE INDEX "online_orders_shop_id_idx" ON "online_orders"("shop_id");

-- CreateIndex
CREATE UNIQUE INDEX "online_orders_shop_id_numero_key" ON "online_orders"("shop_id", "numero");

-- CreateIndex
CREATE INDEX "online_order_lines_organization_id_idx" ON "online_order_lines"("organization_id");

-- CreateIndex
CREATE INDEX "online_order_lines_online_order_id_idx" ON "online_order_lines"("online_order_id");

-- AddForeignKey
ALTER TABLE "online_orders" ADD CONSTRAINT "online_orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "online_orders" ADD CONSTRAINT "online_orders_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "online_orders" ADD CONSTRAINT "online_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "online_orders" ADD CONSTRAINT "online_orders_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "online_order_lines" ADD CONSTRAINT "online_order_lines_online_order_id_fkey" FOREIGN KEY ("online_order_id") REFERENCES "online_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "online_order_lines" ADD CONSTRAINT "online_order_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS : online_orders/online_order_lines dépendent d'une boutique, même
-- groupe que sales/sale_lines.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['online_orders', 'online_order_lines']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING (
           organization_id = app_current_tenant_id()
           AND (app_current_shop_id() IS NULL OR shop_id = app_current_shop_id())
         )
         WITH CHECK (
           organization_id = app_current_tenant_id()
           AND (app_current_shop_id() IS NULL OR shop_id = app_current_shop_id())
         )',
      t
    );
  END LOOP;
END
$$;

GRANT SELECT, INSERT, UPDATE ON "online_orders" TO tacynt_app;
GRANT SELECT, INSERT, UPDATE ON "online_order_lines" TO tacynt_app;
