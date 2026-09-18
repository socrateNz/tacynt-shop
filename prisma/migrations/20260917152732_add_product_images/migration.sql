-- CreateTable
CREATE TABLE "product_images" (
    "product_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "image_data" BYTEA,
    "image_mime_type" TEXT,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("product_id")
);

-- CreateIndex
CREATE INDEX "product_images_organization_id_idx" ON "product_images"("organization_id");

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS : product_images n'est pas rattachée à une boutique (comme
-- organization_branding), policy sur organization_id seul.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['product_images']
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

GRANT SELECT, INSERT, UPDATE, DELETE ON "product_images" TO tacynt_app;
