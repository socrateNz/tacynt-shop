-- CreateEnum
CREATE TYPE "stock_transfer_status" AS ENUM ('DEMANDE', 'EXPEDIE', 'RECU', 'ANNULE');

-- CreateTable
CREATE TABLE "stock_transfers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "from_shop_id" UUID NOT NULL,
    "to_shop_id" UUID NOT NULL,
    "numero" TEXT NOT NULL,
    "statut" "stock_transfer_status" NOT NULL DEFAULT 'DEMANDE',
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfer_lines" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "from_shop_id" UUID NOT NULL,
    "to_shop_id" UUID NOT NULL,
    "stock_transfer_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "quantite_demandee" DECIMAL(14,3) NOT NULL,
    "quantite_expediee" DECIMAL(14,3),
    "cout_unitaire_expedition" DECIMAL(14,4),
    "quantite_recue" DECIMAL(14,3),

    CONSTRAINT "stock_transfer_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_transfers_organization_id_idx" ON "stock_transfers"("organization_id");

-- CreateIndex
CREATE INDEX "stock_transfers_from_shop_id_idx" ON "stock_transfers"("from_shop_id");

-- CreateIndex
CREATE INDEX "stock_transfers_to_shop_id_idx" ON "stock_transfers"("to_shop_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_transfers_organization_id_numero_key" ON "stock_transfers"("organization_id", "numero");

-- CreateIndex
CREATE INDEX "stock_transfer_lines_organization_id_idx" ON "stock_transfer_lines"("organization_id");

-- CreateIndex
CREATE INDEX "stock_transfer_lines_stock_transfer_id_idx" ON "stock_transfer_lines"("stock_transfer_id");

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_from_shop_id_fkey" FOREIGN KEY ("from_shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_to_shop_id_fkey" FOREIGN KEY ("to_shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_lines" ADD CONSTRAINT "stock_transfer_lines_stock_transfer_id_fkey" FOREIGN KEY ("stock_transfer_id") REFERENCES "stock_transfers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_lines" ADD CONSTRAINT "stock_transfer_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS : stock_transfers/stock_transfer_lines touchent DEUX boutiques à la
-- fois (émettrice et destinataire) — policy dédiée, pas le groupe générique
-- à un seul shop_id. Visible sans app.shop_id positionné (vue consolidée),
-- ou si la boutique active est l'une ou l'autre des deux.
ALTER TABLE "stock_transfers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_transfers" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "stock_transfers";
CREATE POLICY tenant_isolation ON "stock_transfers"
  USING (
    organization_id = app_current_tenant_id()
    AND (
      app_current_shop_id() IS NULL
      OR from_shop_id = app_current_shop_id()
      OR to_shop_id = app_current_shop_id()
    )
  )
  WITH CHECK (
    organization_id = app_current_tenant_id()
    AND (
      app_current_shop_id() IS NULL
      OR from_shop_id = app_current_shop_id()
      OR to_shop_id = app_current_shop_id()
    )
  );

ALTER TABLE "stock_transfer_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_transfer_lines" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "stock_transfer_lines";
CREATE POLICY tenant_isolation ON "stock_transfer_lines"
  USING (
    organization_id = app_current_tenant_id()
    AND (
      app_current_shop_id() IS NULL
      OR from_shop_id = app_current_shop_id()
      OR to_shop_id = app_current_shop_id()
    )
  )
  WITH CHECK (
    organization_id = app_current_tenant_id()
    AND (
      app_current_shop_id() IS NULL
      OR from_shop_id = app_current_shop_id()
      OR to_shop_id = app_current_shop_id()
    )
  );

GRANT SELECT, INSERT, UPDATE ON "stock_transfers", "stock_transfer_lines" TO tacynt_app;
