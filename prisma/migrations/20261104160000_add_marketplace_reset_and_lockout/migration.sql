-- Complète 20261104120000_add_marketplace_customers : la première version
-- de cette migration a été appliquée en production avant que les champs de
-- réinitialisation du mot de passe et de verrouillage anti force brute n'y
-- soient ajoutés. Prisma ne rejoue jamais une migration déjà enregistrée,
-- d'où cette migration séparée. IF NOT EXISTS : sans effet sur une base qui
-- aurait déjà reçu la version longue de la migration précédente.
ALTER TABLE "marketplace_customers" ADD COLUMN IF NOT EXISTS "reset_code_hash" TEXT;
ALTER TABLE "marketplace_customers" ADD COLUMN IF NOT EXISTS "reset_code_expires_at" TIMESTAMP(3);
ALTER TABLE "marketplace_customers" ADD COLUMN IF NOT EXISTS "reset_code_sent_at" TIMESTAMP(3);
ALTER TABLE "marketplace_customers" ADD COLUMN IF NOT EXISTS "reset_attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "marketplace_customers" ADD COLUMN IF NOT EXISTS "failed_login_attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "marketplace_customers" ADD COLUMN IF NOT EXISTS "locked_until" TIMESTAMP(3);
