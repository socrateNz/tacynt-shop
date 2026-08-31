-- Correctif n°2 : PostgreSQL ne garantit pas l'évaluation court-circuit de
-- AND/OR dans une policy RLS. Le garde `current_setting(...) <> ''` de la
-- migration précédente n'empêchait donc pas, selon l'ordre choisi par le
-- planner, que le ::uuid soit évalué sur '' et lève une erreur SQL brute au
-- lieu de simplement ne matcher aucune ligne — reproduit en test manuel.
--
-- Fix : pousser NULLIF + cast dans une fonction STABLE, dont le résultat est
-- toujours soit un uuid valide, soit NULL. Une comparaison `col = NULL` ne
-- lève jamais d'erreur, quel que soit l'ordre d'évaluation.

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

CREATE OR REPLACE FUNCTION app_current_tenant_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app_current_shop_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.shop_id', true), '')::uuid
$$;

GRANT EXECUTE ON FUNCTION app_current_tenant_id() TO tacynt_app;
GRANT EXECUTE ON FUNCTION app_current_shop_id() TO tacynt_app;

ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organizations" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "organizations";
CREATE POLICY tenant_isolation ON "organizations"
  USING (id = app_current_tenant_id())
  WITH CHECK (id = app_current_tenant_id());

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
         USING (organization_id = app_current_tenant_id())
         WITH CHECK (organization_id = app_current_tenant_id())',
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
