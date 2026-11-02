-- CreateEnum
CREATE TYPE "rental_unit_amenity" AS ENUM ('WIFI', 'PARKING', 'CLIMATISATION', 'MEUBLE', 'CUISINE_EQUIPEE', 'SALLE_BAIN_PRIVEE', 'SECURITE', 'ASCENSEUR', 'BALCON', 'EAU_INCLUSE', 'ELECTRICITE_INCLUSE');

-- AlterTable
ALTER TABLE "rental_units" ADD COLUMN     "equipements" "rental_unit_amenity"[] DEFAULT ARRAY[]::"rental_unit_amenity"[],
ADD COLUMN     "locality_id" UUID,
ADD COLUMN     "nombre_pieces" INTEGER,
ADD COLUMN     "surface_m2" INTEGER;

-- CreateTable
CREATE TABLE "rental_localities" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "parent_id" UUID,
    "nom" TEXT NOT NULL,

    CONSTRAINT "rental_localities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rental_localities_organization_id_idx" ON "rental_localities"("organization_id");

-- AddForeignKey
ALTER TABLE "rental_localities" ADD CONSTRAINT "rental_localities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_localities" ADD CONSTRAINT "rental_localities_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "rental_localities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_units" ADD CONSTRAINT "rental_units_locality_id_fkey" FOREIGN KEY ("locality_id") REFERENCES "rental_localities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS : rental_localities est une table de référence (ville/quartier),
-- scopée organisation uniquement — pas de shop_id, contrairement aux 5
-- autres tables du module Location. Même groupe/prédicat que "categories"
-- (prisma/rls-manifest.sql), jamais celui des tables scopées boutique.
ALTER TABLE "rental_localities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rental_localities" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "rental_localities";
CREATE POLICY tenant_isolation ON "rental_localities"
  USING (organization_id = app_current_tenant_id())
  WITH CHECK (organization_id = app_current_tenant_id());

GRANT SELECT, INSERT, UPDATE ON "rental_localities" TO tacynt_app;
