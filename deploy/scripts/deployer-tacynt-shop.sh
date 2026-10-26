#!/bin/sh
# Copie de référence — à copier sur le serveur dans
# ~/scripts/deployer-tacynt-shop.sh (chmod 700), voir docs/deployment.md.
#
# Appelé par GitHub Actions via une clé SSH RESTREINTE
# (authorized_keys : command="/home/etarcosdev/scripts/deployer-tacynt-shop.sh $SSH_ORIGINAL_COMMAND",restrict ...),
# même modèle que ~/scripts/deployer-shede.sh sur ce serveur partagé — une
# clé compromise ne peut exécuter QUE ce script, jamais une commande libre.
#
# Contrairement à Shede (build pnpm dans un dossier versionné + bascule de
# symlink), ce projet build une image Docker : le tag d'image Docker joue le
# même rôle d'isolation qu'un dossier versionné — l'ancienne image reste
# intacte tant qu'on ne la remplace pas explicitement, ce qui permet un
# retour en arrière du conteneur applicatif sans jamais toucher à la base.
#
# Usage : deployer-tacynt-shop.sh <commit-sha>
set -eu

COMMIT="${1:-}"
case "$COMMIT" in
  [0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]*) ;;
  *)
    echo "Commit invalide ou manquant : '$COMMIT'" >&2
    exit 1
    ;;
esac

REPO_DIR="/home/etarcosdev/apps/tacynt-shop"
LOG_FILE="/home/etarcosdev/apps/deploiements.log"
LOCK_FILE="/home/etarcosdev/apps/.deploy-tacynt-shop.lock"
APP_PORT=3003
APP_IMAGE="tacynt-shop-app:latest"
ROLLBACK_IMAGE="tacynt-shop-app:rollback"
COMPOSE="sudo docker compose -f docker-compose.prod.yml --env-file .env.production"

log() {
  printf '%s tacynt-shop %s\n' "$(date -Iseconds)" "$1" >> "$LOG_FILE"
}

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Un déploiement tacynt-shop est déjà en cours." >&2
  exit 1
fi

cd "$REPO_DIR"
log "déploiement $COMMIT démarré"

git fetch --quiet origin main
git checkout --quiet "$COMMIT"

# Retague l'image sortante AVANT de reconstruire — seul filet de sécurité
# nécessaire ici (voir l'en-tête du fichier). Silencieux si c'est le tout
# premier déploiement (aucune image "latest" encore taguée).
CURRENT_IMAGE_ID="$(sudo docker images -q "$APP_IMAGE" 2>/dev/null || true)"
if [ -n "$CURRENT_IMAGE_ID" ]; then
  sudo docker tag "$CURRENT_IMAGE_ID" "$ROLLBACK_IMAGE"
fi

$COMPOSE build app migrate

# Migrations AVANT de démarrer le nouveau conteneur applicatif — jamais
# l'inverse (l'app servirait un court instant contre un schéma pas encore à
# jour).
$COMPOSE run --rm migrate npx prisma migrate deploy
$COMPOSE run --rm migrate npx tsx scripts/ensure-runtime-role-password.ts
$COMPOSE up -d

# Vérifie que l'app répond avant de valider le déploiement — même principe
# que le /login de deployer-shede.sh (une minute, par pas de 2 s).
ok=0
i=0
while [ "$i" -lt 30 ]; do
  if curl -sf -o /dev/null "http://127.0.0.1:${APP_PORT}/"; then
    ok=1
    break
  fi
  i=$((i + 1))
  sleep 2
done

if [ "$ok" -ne 1 ]; then
  log "healthcheck échoué pour $COMMIT, retour à l'image précédente"
  if sudo docker image inspect "$ROLLBACK_IMAGE" >/dev/null 2>&1; then
    sudo docker tag "$ROLLBACK_IMAGE" "$APP_IMAGE"
    $COMPOSE up -d --no-build --force-recreate app
    log "conteneur applicatif revenu à l'image précédente — ATTENTION : la base a pu recevoir des migrations plus récentes que le code désormais actif, à vérifier manuellement avant tout nouveau déploiement"
  else
    log "aucune image précédente disponible, rien à restaurer — intervention manuelle requise"
  fi
  exit 1
fi

sudo docker image rm "$ROLLBACK_IMAGE" >/dev/null 2>&1 || true
log "déploiement $COMMIT réussi"
