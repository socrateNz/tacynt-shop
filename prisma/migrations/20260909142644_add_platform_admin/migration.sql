-- CreateTable
CREATE TABLE "platform_admins" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_admin_sessions" (
    "id" UUID NOT NULL,
    "platform_admin_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_admin_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_payments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "montant" DECIMAL(12,2) NOT NULL,
    "devise" TEXT NOT NULL,
    "periode_debut" TIMESTAMP(3) NOT NULL,
    "periode_fin" TIMESTAMP(3) NOT NULL,
    "recorded_by_admin_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_admins_email_key" ON "platform_admins"("email");

-- CreateIndex
CREATE UNIQUE INDEX "platform_admin_sessions_token_hash_key" ON "platform_admin_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "platform_payments_organization_id_idx" ON "platform_payments"("organization_id");

-- AddForeignKey
ALTER TABLE "platform_admin_sessions" ADD CONSTRAINT "platform_admin_sessions_platform_admin_id_fkey" FOREIGN KEY ("platform_admin_id") REFERENCES "platform_admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_payments" ADD CONSTRAINT "platform_payments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_payments" ADD CONSTRAINT "platform_payments_recorded_by_admin_id_fkey" FOREIGN KEY ("recorded_by_admin_id") REFERENCES "platform_admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Isolation dure (Phase 3, M25) : ces trois tables ne sont PAS des tables
-- tenant — pas de RLS (rien à isoler, ce sont des vues délibérément
-- cross-organisation), et le rôle runtime applicatif (tacynt_app) n'y a
-- STRICTEMENT AUCUN accès, même si ALTER DEFAULT PRIVILEGES
-- (prisma/rls-manifest.sql) lui accorde SELECT/INSERT/UPDATE par défaut sur
-- toute nouvelle table créée par le rôle propriétaire des migrations. Seul
-- ce rôle propriétaire (lib/db/platform-client.ts) accède à ces tables :
-- même si le code applicatif se trompait de client Prisma, tacynt_app ne
-- pourrait physiquement rien y lire ni écrire.
REVOKE ALL ON "platform_admins" FROM tacynt_app;
REVOKE ALL ON "platform_admin_sessions" FROM tacynt_app;
REVOKE ALL ON "platform_payments" FROM tacynt_app;
