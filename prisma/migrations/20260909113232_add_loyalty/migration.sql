-- CreateEnum
CREATE TYPE "loyalty_ledger_type" AS ENUM ('GAGNE', 'CONVERTI', 'AJUSTEMENT');

-- AlterEnum
ALTER TYPE "customer_ledger_type" ADD VALUE 'UTILISATION_BON_ACHAT';

-- CreateTable
CREATE TABLE "loyalty_ledger" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "type" "loyalty_ledger_type" NOT NULL,
    "points" INTEGER NOT NULL,
    "document_type" TEXT,
    "document_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "loyalty_ledger_organization_id_idx" ON "loyalty_ledger"("organization_id");

-- CreateIndex
CREATE INDEX "loyalty_ledger_customer_id_idx" ON "loyalty_ledger"("customer_id");

-- AddForeignKey
ALTER TABLE "loyalty_ledger" ADD CONSTRAINT "loyalty_ledger_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS : loyalty_ledger scopée organisation uniquement, même groupe que
-- customers/customer_ledger.
ALTER TABLE "loyalty_ledger" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "loyalty_ledger" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "loyalty_ledger";
CREATE POLICY tenant_isolation ON "loyalty_ledger"
  USING (organization_id = app_current_tenant_id())
  WITH CHECK (organization_id = app_current_tenant_id());

GRANT SELECT, INSERT, UPDATE ON "loyalty_ledger" TO tacynt_app;
