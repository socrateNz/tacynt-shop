-- CreateEnum
CREATE TYPE "customer_ledger_type" AS ENUM ('VENTE_ARDOISE', 'PAIEMENT', 'AJUSTEMENT', 'ANNULATION_VENTE');

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "nom" TEXT NOT NULL,
    "telephone" TEXT,
    "categorie_tarif" TEXT NOT NULL DEFAULT '',
    "plafond_credit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_ledger" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "type" "customer_ledger_type" NOT NULL,
    "montant" DECIMAL(12,2) NOT NULL,
    "document_type" TEXT,
    "document_id" UUID,
    "user_id" UUID,
    "motif" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_category_prices" (
    "organization_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "categorie_tarif" TEXT NOT NULL,
    "prix_vente" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "customer_category_prices_pkey" PRIMARY KEY ("variant_id","shop_id","categorie_tarif")
);

-- CreateIndex
CREATE INDEX "customers_organization_id_idx" ON "customers"("organization_id");

-- CreateIndex
CREATE INDEX "customer_ledger_organization_id_idx" ON "customer_ledger"("organization_id");

-- CreateIndex
CREATE INDEX "customer_ledger_customer_id_idx" ON "customer_ledger"("customer_id");

-- CreateIndex
CREATE INDEX "customer_category_prices_organization_id_idx" ON "customer_category_prices"("organization_id");

-- CreateIndex
CREATE INDEX "customer_category_prices_shop_id_idx" ON "customer_category_prices"("shop_id");

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_ledger" ADD CONSTRAINT "customer_ledger_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_category_prices" ADD CONSTRAINT "customer_category_prices_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_category_prices" ADD CONSTRAINT "customer_category_prices_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS : customers/customer_ledger scopées organisation uniquement (même
-- groupe que categories/products/import_batches dans rls-manifest.sql).
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customers" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "customers";
CREATE POLICY tenant_isolation ON "customers"
  USING (organization_id = app_current_tenant_id())
  WITH CHECK (organization_id = app_current_tenant_id());

ALTER TABLE "customer_ledger" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_ledger" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "customer_ledger";
CREATE POLICY tenant_isolation ON "customer_ledger"
  USING (organization_id = app_current_tenant_id())
  WITH CHECK (organization_id = app_current_tenant_id());

-- RLS : customer_category_prices dépend d'une boutique, même groupe que
-- shop_prices (organization_id = limite dure, shop_id ne filtre en plus que
-- si l'appelant l'a positionné).
ALTER TABLE "customer_category_prices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_category_prices" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "customer_category_prices";
CREATE POLICY tenant_isolation ON "customer_category_prices"
  USING (
    organization_id = app_current_tenant_id()
    AND (app_current_shop_id() IS NULL OR shop_id = app_current_shop_id())
  )
  WITH CHECK (
    organization_id = app_current_tenant_id()
    AND (app_current_shop_id() IS NULL OR shop_id = app_current_shop_id())
  );

GRANT SELECT, INSERT, UPDATE ON "customers", "customer_ledger", "customer_category_prices" TO tacynt_app;
