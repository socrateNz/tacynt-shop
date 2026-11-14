-- CreateEnum
CREATE TYPE "vehicle_driver_mode" AS ENUM ('SANS_CHAUFFEUR', 'AVEC_CHAUFFEUR', 'AU_CHOIX');

-- CreateEnum
CREATE TYPE "vehicle_booking_status" AS ENUM ('DEMANDE', 'CONFIRMEE', 'EN_COURS', 'TERMINEE', 'ANNULEE');

-- AlterTable
ALTER TABLE "shops" ADD COLUMN     "supplement_chauffeur_jour" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "vehicles" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "marque" TEXT NOT NULL,
    "modele" TEXT NOT NULL,
    "annee" INTEGER,
    "description" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "prix_jour" DECIMAL(12,2) NOT NULL,
    "afficher_prix" BOOLEAN NOT NULL DEFAULT true,
    "chauffeur_mode" "vehicle_driver_mode" NOT NULL DEFAULT 'AU_CHOIX',
    "caution" DECIMAL(12,2),
    "afficher_caution" BOOLEAN NOT NULL DEFAULT true,
    "quantite" INTEGER NOT NULL DEFAULT 1,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_images" (
    "id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "image_data" BYTEA,
    "image_mime_type" TEXT,

    CONSTRAINT "vehicle_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_bookings" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "numero" TEXT NOT NULL,
    "customer_id" UUID,
    "nom_client" TEXT NOT NULL,
    "telephone_client" TEXT NOT NULL,
    "statut" "vehicle_booking_status" NOT NULL DEFAULT 'DEMANDE',
    "date_debut" DATE NOT NULL,
    "date_fin" DATE NOT NULL,
    "nombre_jours" INTEGER NOT NULL,
    "avec_chauffeur" BOOLEAN NOT NULL DEFAULT false,
    "prix_jour" DECIMAL(12,2) NOT NULL,
    "supplement_chauffeur_jour" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "caution" DECIMAL(12,2),
    "total" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,
    "marketplace_customer_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "returned_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),

    CONSTRAINT "vehicle_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vehicles_organization_id_idx" ON "vehicles"("organization_id");

-- CreateIndex
CREATE INDEX "vehicles_shop_id_idx" ON "vehicles"("shop_id");

-- CreateIndex
CREATE INDEX "vehicle_images_organization_id_idx" ON "vehicle_images"("organization_id");

-- CreateIndex
CREATE INDEX "vehicle_images_vehicle_id_idx" ON "vehicle_images"("vehicle_id");

-- CreateIndex
CREATE INDEX "vehicle_bookings_organization_id_idx" ON "vehicle_bookings"("organization_id");

-- CreateIndex
CREATE INDEX "vehicle_bookings_shop_id_idx" ON "vehicle_bookings"("shop_id");

-- CreateIndex
CREATE INDEX "vehicle_bookings_vehicle_id_idx" ON "vehicle_bookings"("vehicle_id");

-- CreateIndex
CREATE INDEX "vehicle_bookings_marketplace_customer_id_idx" ON "vehicle_bookings"("marketplace_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_bookings_shop_id_numero_key" ON "vehicle_bookings"("shop_id", "numero");

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_images" ADD CONSTRAINT "vehicle_images_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_bookings" ADD CONSTRAINT "vehicle_bookings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_bookings" ADD CONSTRAINT "vehicle_bookings_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_bookings" ADD CONSTRAINT "vehicle_bookings_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_bookings" ADD CONSTRAINT "vehicle_bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_bookings" ADD CONSTRAINT "vehicle_bookings_marketplace_customer_id_fkey" FOREIGN KEY ("marketplace_customer_id") REFERENCES "marketplace_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;



-- RLS : les trois tables du module Location de véhicules sont scopées
-- boutique, même groupe/prédicat que rental_units / laundry_items
-- (prisma/rls-manifest.sql).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['vehicles', 'vehicle_images', 'vehicle_bookings']
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

-- Jamais de DELETE : désactivation (véhicules) / annulation (réservations).
GRANT SELECT, INSERT, UPDATE ON "vehicles" TO tacynt_app;
GRANT SELECT, INSERT, UPDATE ON "vehicle_bookings" TO tacynt_app;
-- Exception, même précédent que rental_unit_images : une photo retirée à
-- l'édition se supprime réellement.
GRANT SELECT, INSERT, UPDATE, DELETE ON "vehicle_images" TO tacynt_app;
