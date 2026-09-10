-- Écrite à la main car `prisma migrate dev` refuse de générer ce diff en
-- environnement non interactif (avertissement sur la contrainte unique
-- custom_domain) — même situation que 20260831000001_add_register_code.
-- Sûr : une contrainte UNIQUE Postgres autorise plusieurs NULL (chaque NULL
-- est distinct), donc aucune donnée existante ne peut la violer.

-- AlterTable
ALTER TABLE "organizations"
  ADD COLUMN "custom_domain" TEXT,
  ADD COLUMN "custom_domain_verified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "custom_domain_verification_token" TEXT,
  ADD COLUMN "custom_domain_verified_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "organizations_custom_domain_key" ON "organizations"("custom_domain");

-- CreateTable
CREATE TABLE "organization_branding" (
    "organization_id" UUID NOT NULL,
    "logo_data" BYTEA,
    "logo_mime_type" TEXT,

    CONSTRAINT "organization_branding_pkey" PRIMARY KEY ("organization_id")
);

-- AddForeignKey
ALTER TABLE "organization_branding" ADD CONSTRAINT "organization_branding_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS : organization_branding dépend d'une seule organisation, aucune
-- notion de boutique — même groupe que customers/categories.
ALTER TABLE "organization_branding" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organization_branding" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "organization_branding";
CREATE POLICY tenant_isolation ON "organization_branding"
  USING (organization_id = app_current_tenant_id())
  WITH CHECK (organization_id = app_current_tenant_id());

GRANT SELECT, INSERT, UPDATE ON "organization_branding" TO tacynt_app;
