-- AlterTable: nom ajouté nullable d'abord, retro-rempli, puis contraint —
-- un simple "NOT NULL" échouerait sur toute organisation qui a déjà des
-- utilisateurs (partie locale de l'email en attendant qu'un propriétaire le
-- corrige — aucune autre donnée exploitable n'existe pour ces lignes).
ALTER TABLE "users" ADD COLUMN     "nom" TEXT;

UPDATE "users" SET "nom" = split_part("email", '@', 1) WHERE "nom" IS NULL;

ALTER TABLE "users" ALTER COLUMN "nom" SET NOT NULL;
