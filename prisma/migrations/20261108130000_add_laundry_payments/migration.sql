-- AlterTable
ALTER TABLE "laundry_orders" ADD COLUMN     "mode_paiement" "online_order_payment_mode" NOT NULL DEFAULT 'RECEPTION';

-- CreateTable
CREATE TABLE "laundry_payments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "laundry_order_id" UUID NOT NULL,
    "fournisseur" "payment_provider" NOT NULL DEFAULT 'CODEES',
    "statut" "online_order_payment_status" NOT NULL DEFAULT 'INITIE',
    "montant" DECIMAL(14,2) NOT NULL,
    "devise" TEXT NOT NULL DEFAULT 'XAF',
    "reference_externe" TEXT,
    "dernier_statut_brut" TEXT,
    "erreur_brute" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "laundry_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "laundry_payments_reference_externe_key" ON "laundry_payments"("reference_externe");

-- CreateIndex
CREATE INDEX "laundry_payments_organization_id_idx" ON "laundry_payments"("organization_id");

-- CreateIndex
CREATE INDEX "laundry_payments_laundry_order_id_idx" ON "laundry_payments"("laundry_order_id");

-- AddForeignKey
ALTER TABLE "laundry_payments" ADD CONSTRAINT "laundry_payments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laundry_payments" ADD CONSTRAINT "laundry_payments_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laundry_payments" ADD CONSTRAINT "laundry_payments_laundry_order_id_fkey" FOREIGN KEY ("laundry_order_id") REFERENCES "laundry_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- RLS : table scopée boutique, même prédicat que laundry_orders.
ALTER TABLE "laundry_payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "laundry_payments" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "laundry_payments";
CREATE POLICY tenant_isolation ON "laundry_payments"
  USING (
    organization_id = app_current_tenant_id()
    AND (app_current_shop_id() IS NULL OR shop_id = app_current_shop_id())
  )
  WITH CHECK (
    organization_id = app_current_tenant_id()
    AND (app_current_shop_id() IS NULL OR shop_id = app_current_shop_id())
  );
GRANT SELECT, INSERT, UPDATE ON "laundry_payments" TO tacynt_app;
