-- Row Level Security — Tacynt Shop, Phase 1.
--
-- Prisma ne connaît pas les policies RLS : ce fichier est appliqué à la main
-- via une migration créée avec `prisma migrate dev --create-only` (jamais
-- générée automatiquement). Comme Prisma ne diffe que schema.prisma contre
-- l'historique de migrations — jamais le contenu réel des policies — ce SQL
-- survit intact aux futures `prisma migrate dev`.
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

-- Fonctions d'accès au contexte tenant, plutôt qu'un cast ::uuid en ligne.
--
-- Piège vérifié en pratique à deux reprises : (1) current_setting(x, true)
-- renvoie '' (pas NULL) une fois qu'un set_config(..., true) précédent a
-- expiré sur une connexion réutilisée par le pool ; (2) PostgreSQL ne
-- garantit PAS l'évaluation court-circuit de AND/OR dans une policy — un
-- garde `current_setting(...) <> '' AND col = current_setting(...)::uuid`
-- peut donc évaluer le ::uuid sur '' malgré la garde et lever une erreur SQL
-- brute au lieu de simplement ne matcher aucune ligne. La solution robuste
-- est de pousser le NULLIF + cast dans une fonction STABLE : son résultat
-- est toujours soit un uuid valide, soit NULL — jamais une chaîne qui peut
-- exploser au cast, quel que soit l'ordre d'évaluation choisi par le planner.
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

-- organizations : cas particulier, le prédicat porte sur `id` lui-même
-- (une organisation EST le tenant), pas sur une colonne organization_id.
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organizations" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "organizations";
CREATE POLICY tenant_isolation ON "organizations"
  USING (id = app_current_tenant_id())
  WITH CHECK (id = app_current_tenant_id());

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
         USING (organization_id = app_current_tenant_id())
         WITH CHECK (organization_id = app_current_tenant_id())',
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
-- organisation. `app_current_shop_id() IS NULL` remplace l'ancien
-- `current_setting(...) = ''` pour la même raison que ci-dessus.
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
