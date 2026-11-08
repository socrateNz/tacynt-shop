-- CreateEnum
CREATE TYPE "laundry_order_status" AS ENUM ('EN_ATTENTE', 'CONFIRMEE', 'COLLECTEE', 'EN_LAVAGE', 'PRETE', 'TERMINEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "laundry_pickup_mode" AS ENUM ('COLLECTE_DOMICILE', 'DEPOT_BOUTIQUE');

-- CreateEnum
CREATE TYPE "laundry_return_mode" AS ENUM ('LIVRAISON', 'RETRAIT_BOUTIQUE');

-- CreateTable
CREATE TABLE "laundry_items" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "nom" TEXT NOT NULL,
    "categorie" TEXT,
    "prix_unitaire" DECIMAL(12,2) NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "laundry_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "laundry_orders" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "numero" TEXT NOT NULL,
    "customer_id" UUID,
    "marketplace_customer_id" UUID,
    "nom_client" TEXT NOT NULL,
    "telephone_client" TEXT NOT NULL,
    "email_client" TEXT,
    "mode_aller" "laundry_pickup_mode" NOT NULL,
    "mode_retour" "laundry_return_mode" NOT NULL,
    "delivery_zone_id" UUID,
    "zone_livraison_nom" TEXT,
    "lieu_dit" TEXT,
    "notes" TEXT,
    "statut" "laundry_order_status" NOT NULL DEFAULT 'EN_ATTENTE',
    "montant_declare" DECIMAL(14,2) NOT NULL,
    "frais_collecte" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "frais_livraison" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_declare" DECIMAL(14,2) NOT NULL,
    "montant_recompte" DECIMAL(14,2),
    "regularisation" DECIMAL(14,2),
    "recompte_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMP(3),
    "collected_at" TIMESTAMP(3),
    "ready_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),

    CONSTRAINT "laundry_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "laundry_order_lines" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "laundry_order_id" UUID NOT NULL,
    "laundry_item_id" UUID NOT NULL,
    "designation" TEXT NOT NULL,
    "prix_unitaire" DECIMAL(12,2) NOT NULL,
    "quantite_declaree" INTEGER NOT NULL,
    "quantite_recomptee" INTEGER,

    CONSTRAINT "laundry_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "laundry_items_organization_id_idx" ON "laundry_items"("organization_id");

-- CreateIndex
CREATE INDEX "laundry_items_shop_id_idx" ON "laundry_items"("shop_id");

-- CreateIndex
CREATE INDEX "laundry_orders_organization_id_idx" ON "laundry_orders"("organization_id");

-- CreateIndex
CREATE INDEX "laundry_orders_shop_id_idx" ON "laundry_orders"("shop_id");

-- CreateIndex
CREATE INDEX "laundry_orders_marketplace_customer_id_idx" ON "laundry_orders"("marketplace_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "laundry_orders_shop_id_numero_key" ON "laundry_orders"("shop_id", "numero");

-- CreateIndex
CREATE INDEX "laundry_order_lines_organization_id_idx" ON "laundry_order_lines"("organization_id");

-- CreateIndex
CREATE INDEX "laundry_order_lines_laundry_order_id_idx" ON "laundry_order_lines"("laundry_order_id");

-- AddForeignKey
ALTER TABLE "laundry_items" ADD CONSTRAINT "laundry_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laundry_items" ADD CONSTRAINT "laundry_items_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laundry_orders" ADD CONSTRAINT "laundry_orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laundry_orders" ADD CONSTRAINT "laundry_orders_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laundry_orders" ADD CONSTRAINT "laundry_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laundry_orders" ADD CONSTRAINT "laundry_orders_marketplace_customer_id_fkey" FOREIGN KEY ("marketplace_customer_id") REFERENCES "marketplace_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laundry_orders" ADD CONSTRAINT "laundry_orders_delivery_zone_id_fkey" FOREIGN KEY ("delivery_zone_id") REFERENCES "delivery_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laundry_order_lines" ADD CONSTRAINT "laundry_order_lines_laundry_order_id_fkey" FOREIGN KEY ("laundry_order_id") REFERENCES "laundry_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laundry_order_lines" ADD CONSTRAINT "laundry_order_lines_laundry_item_id_fkey" FOREIGN KEY ("laundry_item_id") REFERENCES "laundry_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- RLS : les trois tables du module Blanchisserie sont scopées boutique,
-- même groupe/prédicat que online_orders/rental_units
-- (prisma/rls-manifest.sql).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['laundry_items', 'laundry_orders', 'laundry_order_lines']
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
    -- Jamais de DELETE : désactivation (articles) / annulation (commandes).
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON %I TO tacynt_app', t);
  END LOOP;
END
$$;
