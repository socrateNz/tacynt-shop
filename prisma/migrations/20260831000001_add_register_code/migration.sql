-- Table vide en pratique à ce stade (données de test uniquement) : colonne
-- NOT NULL sans défaut sûre ici. Écrite à la main car `prisma migrate dev`
-- refuse de générer ce diff en environnement non interactif.
ALTER TABLE "registers" ADD COLUMN "code" TEXT NOT NULL;

CREATE UNIQUE INDEX "registers_shop_id_code_key" ON "registers"("shop_id", "code");
