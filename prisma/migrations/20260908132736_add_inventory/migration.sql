-- CreateEnum
CREATE TYPE "inventory_session_type" AS ENUM ('COMPLET', 'PARTIEL');

-- CreateEnum
CREATE TYPE "inventory_session_status" AS ENUM ('EN_COURS', 'VALIDEE', 'ANNULEE');

-- CreateTable
CREATE TABLE "inventory_sessions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "type" "inventory_session_type" NOT NULL,
    "category_id" UUID,
    "statut" "inventory_session_status" NOT NULL DEFAULT 'EN_COURS',
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validated_at" TIMESTAMP(3),

    CONSTRAINT "inventory_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_counts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "inventory_session_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "quantite_theorique" DECIMAL(14,3) NOT NULL,
    "quantite_comptee" DECIMAL(14,3),
    "cump_au_comptage" DECIMAL(14,4) NOT NULL,
    "compte_par" UUID,
    "compted_at" TIMESTAMP(3),

    CONSTRAINT "inventory_counts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inventory_sessions_organization_id_idx" ON "inventory_sessions"("organization_id");

-- CreateIndex
CREATE INDEX "inventory_sessions_shop_id_idx" ON "inventory_sessions"("shop_id");

-- CreateIndex
CREATE INDEX "inventory_counts_organization_id_idx" ON "inventory_counts"("organization_id");

-- CreateIndex
CREATE INDEX "inventory_counts_inventory_session_id_idx" ON "inventory_counts"("inventory_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_counts_inventory_session_id_variant_id_key" ON "inventory_counts"("inventory_session_id", "variant_id");

-- AddForeignKey
ALTER TABLE "inventory_sessions" ADD CONSTRAINT "inventory_sessions_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_sessions" ADD CONSTRAINT "inventory_sessions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_inventory_session_id_fkey" FOREIGN KEY ("inventory_session_id") REFERENCES "inventory_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS : inventory_sessions/inventory_counts dépendent d'une boutique, même
-- groupe que sales/purchase_orders/expenses.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['inventory_sessions', 'inventory_counts']
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

GRANT SELECT, INSERT, UPDATE ON "inventory_sessions", "inventory_counts" TO tacynt_app;
