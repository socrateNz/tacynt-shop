-- Row Level Security — Tacynt Shop, Phase 1.
--
-- Prisma ne connaît pas les policies RLS : ce fichier est appliqué à la main
-- via une migration créée avec `prisma migrate dev --create-only` (jamais
-- générée automatiquement). Comme Prisma ne diffe que schema.prisma contre
-- l'historique de migrations — jamais le contenu réel des policies — ce SQL
-- survit intact aux futures `prisma migrate dev`. Copie de référence tenue à
-- jour dans prisma/rls-manifest.sql.
--
-- Règle : le rôle propriétaire des migrations (tacynt_owner, DATABASE_URL)
-- bypass RLS par défaut sur les tables qu'il possède. Il ne doit JAMAIS
-- servir aux requêtes applicatives. Le rôle runtime (tacynt_app,
-- RUNTIME_DATABASE_URL) n'a que SELECT/INSERT/UPDATE (jamais DELETE — tout
-- ce qui doit disparaître se désactive, ne se supprime pas) et les tables
-- sont en FORCE ROW LEVEL SECURITY : même son propriétaire n'y échapperait
-- pas si on l'utilisait par erreur (seul un rôle superuser le peut, et
-- l'application ne doit jamais se connecter en superuser).

-- Mot de passe de développement local uniquement. Avant tout déploiement
-- réel : créer/renommer ce rôle avec un mot de passe géré par un secret
-- manager, jamais garder celui-ci versionné dans l'historique de migration.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'tacynt_app') THEN
    CREATE ROLE tacynt_app LOGIN PASSWORD 'tacynt_app_dev_password';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO tacynt_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO tacynt_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE ON TABLES TO tacynt_app;

-- organizations : cas particulier, le prédicat porte sur `id` lui-même
-- (une organisation EST le tenant), pas sur une colonne organization_id.
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organizations" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "organizations";
CREATE POLICY tenant_isolation ON "organizations"
  USING (id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (id = current_setting('app.tenant_id', true)::uuid);

-- Tables scopées organisation uniquement (pas de notion de boutique).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'shops', 'users', 'user_shops', 'categories', 'products',
    'product_variants', 'audit_logs', 'sessions'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING (organization_id = current_setting(''app.tenant_id'', true)::uuid)
         WITH CHECK (organization_id = current_setting(''app.tenant_id'', true)::uuid)',
      t
    );
  END LOOP;
END
$$;

-- Tables dépendantes d'un point de vente : organization_id est la limite
-- dure (jamais franchissable), shop_id ne filtre EN PLUS que si l'appelant
-- l'a positionné (withTenantContext({shopId})). Sans app.shop_id positionné
-- (ex : rapport consolidé propriétaire multi-boutiques), toutes les
-- boutiques de l'organisation restent visibles — jamais celles d'une autre
-- organisation.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'shop_prices', 'stock_levels', 'stock_movements', 'registers',
    'cash_sessions', 'sales', 'sale_lines', 'payments', 'stock_alerts'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING (
           organization_id = current_setting(''app.tenant_id'', true)::uuid
           AND (
             current_setting(''app.shop_id'', true) = %L
             OR shop_id = current_setting(''app.shop_id'', true)::uuid
           )
         )
         WITH CHECK (
           organization_id = current_setting(''app.tenant_id'', true)::uuid
           AND (
             current_setting(''app.shop_id'', true) = %L
             OR shop_id = current_setting(''app.shop_id'', true)::uuid
           )
         )',
      t, '', ''
    );
  END LOOP;
END
$$;
