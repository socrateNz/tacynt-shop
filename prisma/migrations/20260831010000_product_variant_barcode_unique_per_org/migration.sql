-- Le code-barres doit être unique par organisation, pas globalement : deux
-- boutiques différentes peuvent légitimement utiliser le même code-barres
-- interne. Une contrainte moins restrictive ne peut jamais échouer sur des
-- données existantes (tout ce qui passait le contrôle global passe
-- nécessairement le contrôle par organisation).
DROP INDEX "product_variants_code_barres_key";

CREATE UNIQUE INDEX "product_variants_organization_id_code_barres_key"
  ON "product_variants"("organization_id", "code_barres");
