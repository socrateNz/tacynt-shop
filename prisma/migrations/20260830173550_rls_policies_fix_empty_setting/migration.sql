-- Correctif : current_setting(x, true) renvoie '' (pas NULL) quand un
-- set_config(..., true) précédent a expiré sur une connexion réutilisée par
-- le pool, faisant planter le ::uuid au lieu de simplement ne matcher aucune
-- ligne. Constaté en testant manuellement l'isolation après la migration
-- précédente. Ce fichier réapplique le manifeste complet et à jour —
-- prisma/rls-manifest.sql — les DROP POLICY IF EXISTS le rendent rejouable
-- sans effet de bord sur les rôles/grants déjà en place.

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

ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organizations" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "organizations";
CREATE POLICY tenant_isolation ON "organizations"
  USING (
    current_setting('app.tenant_id', true) <> ''
    AND id = current_setting('app.tenant_id', true)::uuid
  )
  WITH CHECK (
    current_setting('app.tenant_id', true) <> ''
    AND id = current_setting('app.tenant_id', true)::uuid
  );

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
         USING (
           current_setting(''app.tenant_id'', true) <> ''''
           AND organization_id = current_setting(''app.tenant_id'', true)::uuid
         )
         WITH CHECK (
           current_setting(''app.tenant_id'', true) <> ''''
           AND organization_id = current_setting(''app.tenant_id'', true)::uuid
         )',
      t
    );
  END LOOP;
END
$$;

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
           current_setting(''app.tenant_id'', true) <> ''''
           AND organization_id = current_setting(''app.tenant_id'', true)::uuid
           AND (
             current_setting(''app.shop_id'', true) = %L
             OR shop_id = current_setting(''app.shop_id'', true)::uuid
           )
         )
         WITH CHECK (
           current_setting(''app.tenant_id'', true) <> ''''
           AND organization_id = current_setting(''app.tenant_id'', true)::uuid
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
