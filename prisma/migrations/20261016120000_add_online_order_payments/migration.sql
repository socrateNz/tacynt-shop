-- Module paiement en ligne (Codees, Mobile Money) : activable boutique par
-- boutique, jamais au niveau organisation. OnlineOrder.email_client est
-- requis par l'API Codees (customer_email) uniquement quand ce booléen est
-- actif.
ALTER TABLE "shops" ADD COLUMN "paiement_en_ligne_actif" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "online_orders" ADD COLUMN "email_client" TEXT;

-- CreateEnum
CREATE TYPE "online_order_payment_status" AS ENUM ('INITIE', 'EN_ATTENTE', 'REUSSI', 'ECHEC', 'EXPIRE');

-- CreateEnum
CREATE TYPE "online_order_payment_event_source" AS ENUM ('INITIATION', 'WEBHOOK', 'STATUT_POLL', 'EXPIRATION_FILET');

-- CreateTable
CREATE TABLE "online_order_payments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "online_order_id" UUID NOT NULL,
    "statut" "online_order_payment_status" NOT NULL DEFAULT 'INITIE',
    "montant" DECIMAL(14,2) NOT NULL,
    "devise" TEXT NOT NULL DEFAULT 'XAF',
    "reference_externe" TEXT,
    "idempotency_key" UUID NOT NULL,
    "erreur_brute" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "online_order_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "online_order_payment_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "online_order_payment_id" UUID NOT NULL,
    "source" "online_order_payment_event_source" NOT NULL,
    "statut_brut" TEXT,
    "payload_brut" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "online_order_payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "online_order_payments_reference_externe_key" ON "online_order_payments"("reference_externe");
CREATE UNIQUE INDEX "online_order_payments_idempotency_key_key" ON "online_order_payments"("idempotency_key");
CREATE INDEX "online_order_payments_organization_id_idx" ON "online_order_payments"("organization_id");
CREATE INDEX "online_order_payments_online_order_id_idx" ON "online_order_payments"("online_order_id");
CREATE INDEX "online_order_payment_events_organization_id_idx" ON "online_order_payment_events"("organization_id");
CREATE INDEX "online_order_payment_events_online_order_payment_id_idx" ON "online_order_payment_events"("online_order_payment_id");

-- AddForeignKey
ALTER TABLE "online_order_payments" ADD CONSTRAINT "online_order_payments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "online_order_payments" ADD CONSTRAINT "online_order_payments_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "online_order_payments" ADD CONSTRAINT "online_order_payments_online_order_id_fkey" FOREIGN KEY ("online_order_id") REFERENCES "online_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "online_order_payment_events" ADD CONSTRAINT "online_order_payment_events_online_order_payment_id_fkey" FOREIGN KEY ("online_order_payment_id") REFERENCES "online_order_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS : online_order_payments/online_order_payment_events dépendent d'une
-- boutique, même groupe que online_orders/online_order_lines.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['online_order_payments', 'online_order_payment_events']
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

GRANT SELECT, INSERT, UPDATE ON "online_order_payments" TO tacynt_app;
GRANT SELECT, INSERT, UPDATE ON "online_order_payment_events" TO tacynt_app;
