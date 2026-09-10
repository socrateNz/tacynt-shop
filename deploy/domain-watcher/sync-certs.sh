#!/bin/sh
# Déclenché par tacynt-domain-watcher.path à chaque écriture dans
# run/pending-domains/ (voir lib/tenant/request-cert-refresh.ts, appelé à
# chaque inscription réussie). Étend le certificat Let's Encrypt existant
# avec la liste COMPLÈTE des boutiques à jour, en réutilisant le Certbot déjà
# installé sur ce serveur (mêmes principes que le certificat des autres
# sites) — jamais de wildcard, jamais de DNS-01, uniquement HTTP-01 via le
# plugin nginx déjà en place.
#
# Limite Let's Encrypt : 100 noms par certificat. Au-delà, ce script échouera
# et il faudra répartir les boutiques sur plusieurs certificats — pas géré
# ici (aucune boutique n'approche ce volume à ce stade).
set -eu

PENDING_DIR="/opt/tacynt-shop/run/pending-domains"
REQUEST_FILE="$PENDING_DIR/refresh.request"
PROCESSING_FILE="$REQUEST_FILE.processing"
CERT_NAME="shop-tacynt-com"
ROOT_DOMAIN="shop.tacynt.com"
LOG_TAG="tacynt-domain-watcher"

[ -f "$REQUEST_FILE" ] || exit 0

# Consommé immédiatement : un nouveau déclenchement systemd pendant ce
# traitement (ou celui causé par notre propre suppression en fin de script)
# ne retraite jamais le même fichier.
mv "$REQUEST_FILE" "$PROCESSING_FILE"

set -- -d "$ROOT_DOMAIN"
while IFS= read -r slug; do
  [ -n "$slug" ] || continue
  set -- "$@" -d "${slug}.${ROOT_DOMAIN}"
done < "$PROCESSING_FILE"

if certbot --nginx --cert-name "$CERT_NAME" "$@" --expand -n --agree-tos; then
  systemctl reload nginx
  logger -t "$LOG_TAG" "certificat étendu avec succès ($(wc -l < "$PROCESSING_FILE") boutique(s))"
  rm -f "$PROCESSING_FILE"
else
  # Conservé pour inspection plutôt que supprimé — la prochaine inscription
  # écrira de toute façon un refresh.request à jour (liste complète, jamais
  # incrémentale), donc pas de perte permanente, mais un échec silencieux ici
  # laisserait une boutique sans certificat valide sans aucune trace.
  mv "$PROCESSING_FILE" "$REQUEST_FILE.failed"
  logger -t "$LOG_TAG" "échec de l'extension du certificat, voir /var/log/letsencrypt/letsencrypt.log et $REQUEST_FILE.failed"
  exit 1
fi
