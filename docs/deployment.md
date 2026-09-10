# Déploiement production — Contabo + Docker + nginx + Certbot

Ce document couvre les étapes **manuelles, faites une seule fois** — tout le
reste (build, migrations, redémarrage) est automatisé par
[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) à chaque
push sur `main`.

Architecture : `shop.tacynt.com` (app) + `{organisation}.shop.tacynt.com`
(par boutique) → nginx sur Contabo (déjà installé, TLS Let's Encrypt via le
Certbot déjà en place pour les autres sites du serveur — pas de Cloudflare,
pas de wildcard, HTTP-01 classique) → conteneur Docker de l'app
(`127.0.0.1:3005`, jamais exposé publiquement) → conteneur Docker Postgres.

Chaque boutique obtient son propre sous-domaine, créé dynamiquement à
l'inscription — un hôte qui n'existe pas encore au moment du premier
`certbot`. `deploy/domain-watcher/` (section 3) étend automatiquement le
certificat à chaque nouvelle inscription, en réutilisant Certbot exactement
comme pour les autres sites du serveur.

## 1. Serveur Contabo — premier déploiement de l'app

Docker est déjà installé (prérequis de ce document).

```bash
git clone <url-du-depot> /home/etarcos/apps/tacynt-shop
cd /home/etarcos/apps/tacynt-shop
cp .env.production.example .env.production
# Éditer .env.production : générer POSTGRES_OWNER_PASSWORD et
# POSTGRES_APP_PASSWORD avec `openssl rand -hex 32` (hexadécimal, jamais
# base64 — un mot de passe base64 peut contenir "/", "+" ou "=", des
# caractères qui cassent le parsing d'une URL postgresql://user:motdepasse@...),
# les reporter aussi dans DATABASE_URL/RUNTIME_DATABASE_URL au même endroit
# du fichier (le mot de passe DOIT être identique aux deux endroits).

# Répertoire partagé avec deploy/domain-watcher/ (section 3) — uid 1001 =
# utilisateur "nextjs" du Dockerfile (conteneur non-root).
mkdir -p /home/etarcos/apps/tacynt-shop/run/pending-domains
chown 1001:1001 /home/etarcos/apps/tacynt-shop/run/pending-domains

docker compose -f docker-compose.prod.yml --env-file .env.production up -d
# "migrate" réutilise l'étape de build complète (node_modules entier, avec le
# vrai CLI Prisma et le dossier prisma/) — jamais l'image "app" allégée
# (.next/standalone), qui n'embarque ni l'un ni l'autre. Contrairement à
# "app", cette image ne se reconstruit PAS automatiquement à chaque
# `docker compose up` — refaire le `build` ci-dessous à chaque fois que le
# code a changé (après un `git pull`) avant de relancer une commande dessus.
docker compose -f docker-compose.prod.yml --env-file .env.production build migrate
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm migrate npx prisma migrate deploy
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm migrate npx tsx scripts/ensure-runtime-role-password.ts
```

Vérifier : `curl -I http://127.0.0.1:3005/` répond `200`, et
`docker compose -f docker-compose.prod.yml ps` montre les deux conteneurs
`healthy`.

## 2. DNS

Chez Camoo.hosting (ou ton fournisseur DNS actuel pour `tacynt.com`),
crée deux enregistrements pointant vers l'IP du serveur Contabo :

- `shop` → A → IP du serveur
- `*.shop` → A → même IP (wildcard **DNS**, pas wildcard de certificat —
  nginx route toutes les requêtes de sous-domaine vers l'app, seul le
  certificat TLS est construit boutique par boutique, voir section 3)

Pas de proxy tiers (pas de Cloudflare) : ces enregistrements pointent
directement sur le serveur.

## 3. nginx + Certbot

```bash
mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled
cp /home/etarcos/apps/tacynt-shop/deploy/nginx/shop.tacynt.com.conf /etc/nginx/sites-available/
ln -s /etc/nginx/sites-available/shop.tacynt.com.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

Puis, avec le Certbot déjà installé sur ce serveur (même outil que pour les
autres sites) :

```bash
certbot --nginx --cert-name shop-tacynt-com -d shop.tacynt.com -n --agree-tos
```

Certbot édite lui-même `shop.tacynt.com.conf` (ajoute le bloc HTTPS et la
redirection 80→443) — exactement comme pour les autres sites du serveur. Le
renouvellement est pris en charge par la tâche planifiée déjà existante de
Certbot, rien à faire de plus pour ça.

Vérifier : `https://shop.tacynt.com` affiche la page marketing de l'app.

### Extension automatique par boutique (`deploy/domain-watcher/`)

À chaque inscription, l'app dépose la liste à jour des boutiques dans
`run/pending-domains/refresh.request` (voir
[`lib/tenant/request-cert-refresh.ts`](../lib/tenant/request-cert-refresh.ts)).
Un service systemd sur l'hôte surveille ce fichier et relance
`certbot --expand` avec la liste complète — le nouveau sous-domaine obtient
un certificat valide en quelques secondes, sans attente.

```bash
chmod +x /home/etarcos/apps/tacynt-shop/deploy/domain-watcher/sync-certs.sh
cp /home/etarcos/apps/tacynt-shop/deploy/domain-watcher/tacynt-domain-watcher.path /etc/systemd/system/
cp /home/etarcos/apps/tacynt-shop/deploy/domain-watcher/tacynt-domain-watcher.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now tacynt-domain-watcher.path
```

Vérifier : après une inscription de test, `journalctl -u tacynt-domain-watcher.service -n 20`
montre "certificat étendu avec succès", et
`certbot certificates --cert-name shop-tacynt-com` liste le nouveau
sous-domaine.

**Limite connue** : Let's Encrypt plafonne un certificat à 100 noms. Non
géré ici (aucune boutique n'approche ce volume à ce stade) — le jour venu,
il faudra répartir les boutiques sur plusieurs certificats.

## 4. GitHub Actions

Dans les paramètres du dépôt (Settings > Secrets and variables > Actions),
ajouter :

- `SSH_HOST` — IP ou nom d'hôte du serveur Contabo.
- `SSH_USER` — utilisateur SSH ayant accès à `/home/etarcos/apps/tacynt-shop` et à Docker.
- `SSH_PRIVATE_KEY` — clé privée correspondante (une clé dédiée au
  déploiement, pas ta clé personnelle — sa clé publique doit être dans
  `~/.ssh/authorized_keys` de `SSH_USER` sur le serveur).

À partir de là, chaque push sur `main` déclenche automatiquement build +
migrations + redémarrage sur le serveur.

## Vérification de bout en bout

- `https://shop.tacynt.com` → page marketing.
- Une inscription crée une organisation joignable en HTTPS valide sur
  `https://{slug}.shop.tacynt.com` en quelques secondes (domain-watcher).
- `https://shop.tacynt.com/platform/login` → espace admin plateforme
  (nécessite de créer le premier compte une fois, via le service `migrate` —
  voir les variables attendues dans scripts/create-platform-admin.ts) :
  ```bash
  docker compose -f docker-compose.prod.yml --env-file .env.production build migrate
  docker compose -f docker-compose.prod.yml --env-file .env.production run --rm \
    -e PLATFORM_ADMIN_EMAIL=... -e PLATFORM_ADMIN_PASSWORD=... \
    migrate npx tsx scripts/create-platform-admin.ts
  ```
- Un push sur `main` met le nouveau code en ligne sans intervention.

## Hors périmètre de ce document

- Sauvegardes automatisées de la base (cahier des charges section 8 :
  quotidienne, rétention 30 jours) — à mettre en place avant un vrai
  lancement commercial, pas couvert ici.
- Registre d'images (GHCR) / build en CI — évolution possible si le VPS
  devient un goulot d'étranglement, pas nécessaire pour démarrer.
- Monitoring/alerting.
- Répartition sur plusieurs certificats au-delà de 100 boutiques (limite
  Let's Encrypt, voir section 3).
