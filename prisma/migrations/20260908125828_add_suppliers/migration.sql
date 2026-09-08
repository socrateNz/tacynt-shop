-- CreateEnum
CREATE TYPE "purchase_order_status" AS ENUM ('BROUILLON', 'ENVOYEE', 'RECUE_PARTIELLE', 'RECUE_COMPLETE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "supplier_ledger_type" AS ENUM ('RECEPTION', 'PAIEMENT', 'AJUSTEMENT');

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "nom" TEXT NOT NULL,
    "telephone" TEXT,
    "email" TEXT,
    "delai_livraison_jours" INTEGER,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_products" (
    "organization_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "prix_achat_dernier" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "est_prefere" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "supplier_products_pkey" PRIMARY KEY ("supplier_id","variant_id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "numero" TEXT NOT NULL,
    "statut" "purchase_order_status" NOT NULL DEFAULT 'BROUILLON',
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_lines" (
    "organization_id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "purchase_order_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "quantite_commandee" DECIMAL(14,3) NOT NULL,
    "prix_unitaire_commande" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "purchase_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "purchase_order_id" UUID,
    "numero" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goods_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipt_lines" (
    "organization_id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "goods_receipt_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "quantite_recue" DECIMAL(14,3) NOT NULL,
    "prix_unitaire_recu" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "goods_receipt_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_ledger" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "type" "supplier_ledger_type" NOT NULL,
    "montant" DECIMAL(12,2) NOT NULL,
    "document_type" TEXT,
    "document_id" UUID,
    "user_id" UUID,
    "motif" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "suppliers_organization_id_idx" ON "suppliers"("organization_id");

-- CreateIndex
CREATE INDEX "supplier_products_organization_id_idx" ON "supplier_products"("organization_id");

-- CreateIndex
CREATE INDEX "purchase_orders_organization_id_idx" ON "purchase_orders"("organization_id");

-- CreateIndex
CREATE INDEX "purchase_orders_shop_id_idx" ON "purchase_orders"("shop_id");

-- CreateIndex
CREATE INDEX "purchase_orders_supplier_id_idx" ON "purchase_orders"("supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_organization_id_numero_key" ON "purchase_orders"("organization_id", "numero");

-- CreateIndex
CREATE INDEX "purchase_order_lines_organization_id_idx" ON "purchase_order_lines"("organization_id");

-- CreateIndex
CREATE INDEX "purchase_order_lines_purchase_order_id_idx" ON "purchase_order_lines"("purchase_order_id");

-- CreateIndex
CREATE INDEX "goods_receipts_organization_id_idx" ON "goods_receipts"("organization_id");

-- CreateIndex
CREATE INDEX "goods_receipts_shop_id_idx" ON "goods_receipts"("shop_id");

-- CreateIndex
CREATE INDEX "goods_receipts_supplier_id_idx" ON "goods_receipts"("supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "goods_receipts_organization_id_numero_key" ON "goods_receipts"("organization_id", "numero");

-- CreateIndex
CREATE INDEX "goods_receipt_lines_organization_id_idx" ON "goods_receipt_lines"("organization_id");

-- CreateIndex
CREATE INDEX "goods_receipt_lines_goods_receipt_id_idx" ON "goods_receipt_lines"("goods_receipt_id");

-- CreateIndex
CREATE INDEX "supplier_ledger_organization_id_idx" ON "supplier_ledger"("organization_id");

-- CreateIndex
CREATE INDEX "supplier_ledger_supplier_id_idx" ON "supplier_ledger"("supplier_id");

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_products" ADD CONSTRAINT "supplier_products_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_products" ADD CONSTRAINT "supplier_products_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_goods_receipt_id_fkey" FOREIGN KEY ("goods_receipt_id") REFERENCES "goods_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_ledger" ADD CONSTRAINT "supplier_ledger_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS : suppliers/supplier_products/supplier_ledger scopées organisation
-- uniquement (même groupe que customers/customer_ledger).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['suppliers', 'supplier_products', 'supplier_ledger']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING (organization_id = app_current_tenant_id())
         WITH CHECK (organization_id = app_current_tenant_id())',
      t
    );
  END LOOP;
END
$$;

-- RLS : purchase_orders/purchase_order_lines/goods_receipts/goods_receipt_lines
-- dépendent d'une boutique, même groupe que sales/sale_lines (organization_id
-- = limite dure, shop_id ne filtre en plus que si l'appelant l'a positionné).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'purchase_orders', 'purchase_order_lines', 'goods_receipts', 'goods_receipt_lines'
  ]
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

GRANT SELECT, INSERT, UPDATE ON
  "suppliers", "supplier_products", "supplier_ledger",
  "purchase_orders", "purchase_order_lines", "goods_receipts", "goods_receipt_lines"
  TO tacynt_app;
