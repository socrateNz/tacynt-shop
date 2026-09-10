-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "enabled_modules" JSONB NOT NULL DEFAULT '[]';
