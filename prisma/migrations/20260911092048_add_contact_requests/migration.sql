-- CreateTable
CREATE TABLE "contact_requests" (
    "id" UUID NOT NULL,
    "nom" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "traite" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_requests_pkey" PRIMARY KEY ("id")
);

-- Formulaire de contact de la landing page publique — visiteur anonyme,
-- aucun contexte tenant. Même isolation dure que platform_admins/
-- platform_admin_sessions/platform_payments (20260909142644_add_platform_admin) :
-- pas de RLS, et tacynt_app n'y a STRICTEMENT AUCUN accès malgré
-- ALTER DEFAULT PRIVILEGES (prisma/rls-manifest.sql) qui lui accorderait
-- sinon SELECT/INSERT/UPDATE par défaut. Seul le rôle propriétaire des
-- migrations (lib/db/platform-client.ts) accède à cette table.
REVOKE ALL ON "contact_requests" FROM tacynt_app;
