-- CreateEnum
CREATE TYPE "rental_unit_type" AS ENUM ('CHAMBRE', 'STUDIO', 'APPARTEMENT', 'VILLA', 'AUTRE');

-- CreateEnum
CREATE TYPE "rental_contract_status" AS ENUM ('DEMANDE', 'CONFIRMEE', 'EN_COURS', 'TERMINEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "rental_installment_status" AS ENUM ('DUE', 'PAYEE');

-- CreateEnum
CREATE TYPE "rental_payment_mode" AS ENUM ('ESPECES', 'MOBILE_MONEY', 'CARTE', 'VIREMENT');

-- CreateTable
CREATE TABLE "rental_units" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "type" "rental_unit_type" NOT NULL,
    "designation" TEXT NOT NULL,
    "description" TEXT,
    "montant_mensuel" DECIMAL(12,2) NOT NULL,
    "duree_min_mois" INTEGER NOT NULL,
    "commission_montant" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_unit_images" (
    "id" UUID NOT NULL,
    "rental_unit_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "image_data" BYTEA,
    "image_mime_type" TEXT,

    CONSTRAINT "rental_unit_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_contracts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "rental_unit_id" UUID NOT NULL,
    "numero" TEXT NOT NULL,
    "customer_id" UUID,
    "nom_client" TEXT NOT NULL,
    "telephone_client" TEXT NOT NULL,
    "statut" "rental_contract_status" NOT NULL DEFAULT 'DEMANDE',
    "date_debut" DATE NOT NULL,
    "duree_mois" INTEGER NOT NULL,
    "montant_mensuel" DECIMAL(12,2) NOT NULL,
    "commission_montant" DECIMAL(12,2) NOT NULL,
    "commission_payee" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),

    CONSTRAINT "rental_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_installments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "rental_contract_id" UUID NOT NULL,
    "mois_index" INTEGER NOT NULL,
    "echeance" DATE NOT NULL,
    "montant_du" DECIMAL(12,2) NOT NULL,
    "statut" "rental_installment_status" NOT NULL DEFAULT 'DUE',
    "paye_le" TIMESTAMP(3),

    CONSTRAINT "rental_installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_payments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "rental_contract_id" UUID NOT NULL,
    "installment_id" UUID,
    "mode" "rental_payment_mode" NOT NULL,
    "montant" DECIMAL(12,2) NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rental_units_organization_id_idx" ON "rental_units"("organization_id");

-- CreateIndex
CREATE INDEX "rental_units_shop_id_idx" ON "rental_units"("shop_id");

-- CreateIndex
CREATE INDEX "rental_unit_images_organization_id_idx" ON "rental_unit_images"("organization_id");

-- CreateIndex
CREATE INDEX "rental_unit_images_rental_unit_id_idx" ON "rental_unit_images"("rental_unit_id");

-- CreateIndex
CREATE INDEX "rental_contracts_organization_id_idx" ON "rental_contracts"("organization_id");

-- CreateIndex
CREATE INDEX "rental_contracts_shop_id_idx" ON "rental_contracts"("shop_id");

-- CreateIndex
CREATE INDEX "rental_contracts_rental_unit_id_idx" ON "rental_contracts"("rental_unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "rental_contracts_shop_id_numero_key" ON "rental_contracts"("shop_id", "numero");

-- CreateIndex
CREATE INDEX "rental_installments_organization_id_idx" ON "rental_installments"("organization_id");

-- CreateIndex
CREATE INDEX "rental_installments_shop_id_idx" ON "rental_installments"("shop_id");

-- CreateIndex
CREATE INDEX "rental_installments_rental_contract_id_idx" ON "rental_installments"("rental_contract_id");

-- CreateIndex
CREATE UNIQUE INDEX "rental_installments_rental_contract_id_mois_index_key" ON "rental_installments"("rental_contract_id", "mois_index");

-- CreateIndex
CREATE INDEX "rental_payments_organization_id_idx" ON "rental_payments"("organization_id");

-- CreateIndex
CREATE INDEX "rental_payments_shop_id_idx" ON "rental_payments"("shop_id");

-- CreateIndex
CREATE INDEX "rental_payments_rental_contract_id_idx" ON "rental_payments"("rental_contract_id");

-- AddForeignKey
ALTER TABLE "rental_units" ADD CONSTRAINT "rental_units_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_units" ADD CONSTRAINT "rental_units_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_unit_images" ADD CONSTRAINT "rental_unit_images_rental_unit_id_fkey" FOREIGN KEY ("rental_unit_id") REFERENCES "rental_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_contracts" ADD CONSTRAINT "rental_contracts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_contracts" ADD CONSTRAINT "rental_contracts_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_contracts" ADD CONSTRAINT "rental_contracts_rental_unit_id_fkey" FOREIGN KEY ("rental_unit_id") REFERENCES "rental_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_contracts" ADD CONSTRAINT "rental_contracts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_installments" ADD CONSTRAINT "rental_installments_rental_contract_id_fkey" FOREIGN KEY ("rental_contract_id") REFERENCES "rental_contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_payments" ADD CONSTRAINT "rental_payments_rental_contract_id_fkey" FOREIGN KEY ("rental_contract_id") REFERENCES "rental_contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_payments" ADD CONSTRAINT "rental_payments_installment_id_fkey" FOREIGN KEY ("installment_id") REFERENCES "rental_installments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS : les 5 tables du module Location dépendent d'une boutique précise
-- (un logement appartient à une boutique) — même groupe que sales/
-- online_orders, jamais le groupe "organisation uniquement".
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'rental_units', 'rental_unit_images', 'rental_contracts',
    'rental_installments', 'rental_payments'
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

GRANT SELECT, INSERT, UPDATE ON "rental_units" TO tacynt_app;
-- Exception à la règle "jamais DELETE" : même précédent que product_images,
-- une photo retirée à l'édition se supprime réellement (ce n'est pas un
-- document métier comme un contrat/une échéance).
GRANT SELECT, INSERT, UPDATE, DELETE ON "rental_unit_images" TO tacynt_app;
GRANT SELECT, INSERT, UPDATE ON "rental_contracts" TO tacynt_app;
GRANT SELECT, INSERT, UPDATE ON "rental_installments" TO tacynt_app;
GRANT SELECT, INSERT, UPDATE ON "rental_payments" TO tacynt_app;
