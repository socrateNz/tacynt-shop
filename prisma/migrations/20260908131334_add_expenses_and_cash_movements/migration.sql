-- CreateEnum
CREATE TYPE "expense_status" AS ENUM ('EN_ATTENTE', 'VALIDEE', 'REJETEE');

-- CreateEnum
CREATE TYPE "cash_movement_type" AS ENUM ('APPRO', 'PRELEVEMENT', 'DEPOT_BANQUE');

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "categorie" TEXT NOT NULL,
    "montant" DECIMAL(12,2) NOT NULL,
    "mode_paiement" "payment_mode" NOT NULL,
    "cash_session_id" UUID,
    "statut" "expense_status" NOT NULL DEFAULT 'EN_ATTENTE',
    "justificatif_data" BYTEA,
    "justificatif_mime_type" TEXT,
    "user_id" UUID NOT NULL,
    "approved_by_user_id" UUID,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_movements" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "cash_session_id" UUID NOT NULL,
    "type" "cash_movement_type" NOT NULL,
    "montant" DECIMAL(12,2) NOT NULL,
    "motif" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "expenses_organization_id_idx" ON "expenses"("organization_id");

-- CreateIndex
CREATE INDEX "expenses_shop_id_idx" ON "expenses"("shop_id");

-- CreateIndex
CREATE INDEX "cash_movements_organization_id_idx" ON "cash_movements"("organization_id");

-- CreateIndex
CREATE INDEX "cash_movements_shop_id_idx" ON "cash_movements"("shop_id");

-- CreateIndex
CREATE INDEX "cash_movements_cash_session_id_idx" ON "cash_movements"("cash_session_id");

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_cash_session_id_fkey" FOREIGN KEY ("cash_session_id") REFERENCES "cash_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_cash_session_id_fkey" FOREIGN KEY ("cash_session_id") REFERENCES "cash_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS : expenses/cash_movements dépendent d'une boutique, même groupe que
-- sales/purchase_orders (organization_id = limite dure, shop_id ne filtre
-- en plus que si l'appelant l'a positionné).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['expenses', 'cash_movements']
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

GRANT SELECT, INSERT, UPDATE ON "expenses", "cash_movements" TO tacynt_app;
