-- Détermine la boutique active PAR DÉFAUT (lib/tenant/active-shop.ts,
-- getActiveShopId) tant que l'utilisateur n'a jamais explicitement changé
-- via le sélecteur d'en-tête — trier par shop_id (un UUID aléatoire)
-- rendait ce choix imprévisible d'une exécution à l'autre dès qu'un
-- utilisateur avait 2 boutiques affectées et pas encore de cookie posé (bug
-- réel constaté). DEFAULT now() couvre les lignes déjà existantes sans
-- retro-remplissage séparé : ces anciennes affectations partagent toutes le
-- même horodatage (celui de cette migration), ce qui reste strictement
-- meilleur que l'ordre aléatoire précédent.
ALTER TABLE "user_shops" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
