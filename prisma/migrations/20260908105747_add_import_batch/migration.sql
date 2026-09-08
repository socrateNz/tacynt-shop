-- CreateEnum
CREATE TYPE "import_batch_status" AS ENUM ('EN_ATTENTE', 'COMMITE', 'ANNULE');

-- CreateTable
CREATE TABLE "import_batches" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "statut" "import_batch_status" NOT NULL DEFAULT 'EN_ATTENTE',
    "payload" JSONB NOT NULL,
    "resultat" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "committed_at" TIMESTAMP(3),

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "import_batches_organization_id_idx" ON "import_batches"("organization_id");

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS : table scopée organisation uniquement (pas de notion de boutique),
-- même groupe que categories/products dans prisma/rls-manifest.sql.
ALTER TABLE "import_batches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "import_batches" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "import_batches";
CREATE POLICY tenant_isolation ON "import_batches"
  USING (organization_id = app_current_tenant_id())
  WITH CHECK (organization_id = app_current_tenant_id());

GRANT SELECT, INSERT, UPDATE ON "import_batches" TO tacynt_app;
