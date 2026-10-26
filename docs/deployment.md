# Déploiement production — VPS partagé `tacynt` (Contabo)

Ce document couvre les étapes **manuelles, faites une seule fois** — tout le
reste (build, migrations, redémarrage) est automatisé par
[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) à chaque
push sur `main`.

⚠️ **Serveur partagé, pas dédié.** Le VPS `tacynt` (`169.58.213.108`,
utilisateur `etarcosdev`) héberge déjà **MedDoc** (`meddoc.tacynt.com`, port
3000, PM2) et **Shede** (`shede.tacynt.com`, port 3001, PM2 + Supabase
auto-hébergé en Docker) — tous deux **en production**. Toute étape de ce
document doit respecter ce qui existe déjà :

- `etarcosdev` n'est **pas** membre du groupe `docker` (ça donnerait root
  sans mot de passe) : **toujours `sudo docker …`**, jamais `docker …` seul.
- Ne **jamais** toucher `~/apps/ecosystem.config.cjs` (configuration PM2 de
  MedDoc, Shede et blanchix), ni aux ports déjà pris : 3000 (MedDoc), 3001
  (Shede), **3002 (blanchix — une 3ᵉ app PM2 sur ce serveur, découverte au
  moment du déploiement, non documentée avant)**, 8000/54322/5433 (Supabase
  de Shede), 27017 (MongoDB). tacynt-shop prend le port suivant réellement
  libre (vérifié avec `sudo ss -tlnp` avant de choisir — ne jamais supposer
  qu'un port est libre sans vérifier) : **3003**.
- Ne jamais modifier les vhosts nginx `meddoc.tacynt.com` ou
  `shede.tacynt.com`, ni le vhost `00-refus-par-defaut` (refuse tout nom
  d'hôte inconnu — à laisser tel quel).
- **Docker contourne UFW.** `/etc/docker/daemon.json` restreint le réseau
  Docker par défaut à `127.0.0.1`, mais ce réglage ne vaut **pas** pour un
  réseau Compose personnalisé — un port mal écrit publierait l'app sur
  Internet. Règle du serveur : **toujours `127.0.0.1:` explicite dans chaque
  port de `docker-compose.prod.yml`** (déjà respecté ici), vérifié avec
  `sudo ss -tlnp | grep docker-proxy` (aucun `0.0.0.0` ni `[::]` pour le port
  3003) puis, **[PC]**, `Test-NetConnection 169.58.213.108 -Port 3003`
  (doit répondre `False`).
- Toute commande touchant `/etc/nginx`, `/etc/systemd/system`, `certbot`, ou
  `docker` demande `sudo` (mot de passe requis — `etarcosdev` n'a pas de
  sudo sans mot de passe).

Repères utiles : **[PC]** = PowerShell sur l'ordinateur Windows ; **[Serveur]**
= session SSH (`etarcosdev@tacynt`). En cas de longue opération, utiliser
`tmux` (la connexion SSH coupe parfois quelques dizaines de secondes).

Architecture : `shop.tacynt.com` (app) + `{organisation}.shop.tacynt.com`
(par boutique) → nginx sur le VPS partagé (déjà installé, TLS Let's Encrypt
via le Certbot déjà en place pour MedDoc/Shede — pas de Cloudflare, pas de
wildcard de certificat, HTTP-01 classique) → conteneur Docker de l'app
(`127.0.0.1:3003`, jamais exposé publiquement) → conteneur Docker Postgres
(propre à tacynt-shop, aucun port exposé à l'hôte — aucun conflit possible
avec MongoDB ou le Postgres de Shede).

Chaque boutique obtient son propre sous-domaine, créé dynamiquement à
l'inscription — un hôte qui n'existe pas encore au moment du premier
`certbot`. `deploy/domain-watcher/` (section 3) étend automatiquement le
certificat à chaque nouvelle inscription, en réutilisant Certbot exactement
comme pour les autres sites du serveur.

## 1. Serveur — premier déploiement de l'app

Docker est déjà installé sur ce serveur (utilisé par Shede).

**[Serveur]**
```bash
cd /home/etarcosdev/apps
git clone <url-du-depot> tacynt-shop
cd tacynt-shop
cp .env.production.example .env.production
# Éditer .env.production : générer POSTGRES_OWNER_PASSWORD et
# POSTGRES_APP_PASSWORD avec `openssl rand -hex 32` (hexadécimal, jamais
# base64 — un mot de passe base64 peut contenir "/", "+" ou "=", des
# caractères qui cassent le parsing d'une URL postgresql://user:motdepasse@...),
# les reporter aussi dans DATABASE_URL/RUNTIME_DATABASE_URL au même endroit
# du fichier (le mot de passe DOIT être identique aux deux endroits).
# Compléter aussi CODEES_API_KEY/CODEES_SECRET_KEY et SMTP_*/EMAIL_FROM
# (paiement en ligne et email de confirmation — voir lib/payments/,
# lib/email/) : valeurs réelles, jamais dans .env.production.example.
chmod 600 .env.production

# Répertoire partagé avec deploy/domain-watcher/ (section 3) — uid 1001 =
# utilisateur "nextjs" du Dockerfile (conteneur non-root).
mkdir -p run/pending-domains
sudo chown 1001:1001 run/pending-domains

sudo docker compose -f docker-compose.prod.yml --env-file .env.production build app migrate
sudo docker compose -f docker-compose.prod.yml --env-file .env.production run --rm migrate npx prisma migrate deploy
sudo docker compose -f docker-compose.prod.yml --env-file .env.production run --rm migrate npx tsx scripts/ensure-runtime-role-password.ts
sudo docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

Vérifier : `curl -I http://127.0.0.1:3003/` répond `200`, et
`sudo docker compose -f docker-compose.prod.yml ps` montre les deux
conteneurs `healthy`.

## 2. DNS

Déjà fait (zone DNS `tacynt.com` chez camoo.hosting) :

- `shop.tacynt.com` → A → `169.58.213.108`
- `*.shop.tacynt.com` → A → `169.58.213.108` (wildcard **DNS**, pas wildcard
  de certificat — nginx route toutes les requêtes de sous-domaine vers
  l'app, seul le certificat TLS est construit boutique par boutique, voir
  section 3)

Ce sont les **mêmes enregistrements, la même IP** que MedDoc/Shede — pas un
serveur dédié. Vérifier une modification sans attendre les caches : **[PC]**
`Resolve-DnsName shop.tacynt.com -Type A -Server ns2.camoogroup.com -DnsOnly`
(serveur faisant autorité).

## 3. nginx + Certbot

**[Serveur]**
```bash
sudo cp /home/etarcosdev/apps/tacynt-shop/deploy/nginx/shop.tacynt.com.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/shop.tacynt.com.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Puis, avec le Certbot déjà installé sur ce serveur (même outil que pour
MedDoc/Shede) :

```bash
sudo certbot --nginx --cert-name shop-tacynt-com -d shop.tacynt.com -n --agree-tos
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

**[Serveur]**
```bash
chmod +x /home/etarcosdev/apps/tacynt-shop/deploy/domain-watcher/sync-certs.sh
sudo cp /home/etarcosdev/apps/tacynt-shop/deploy/domain-watcher/tacynt-domain-watcher.path /etc/systemd/system/
sudo cp /home/etarcosdev/apps/tacynt-shop/deploy/domain-watcher/tacynt-domain-watcher.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now tacynt-domain-watcher.path
```

Vérifier : après une inscription de test, `journalctl -u tacynt-domain-watcher.service -n 20`
montre "certificat étendu avec succès", et
`sudo certbot certificates --cert-name shop-tacynt-com` liste le nouveau
sous-domaine.

**Limite connue** : Let's Encrypt plafonne un certificat à 100 noms. Non
géré ici (aucune boutique n'approche ce volume à ce stade) — le jour venu,
il faudra répartir les boutiques sur plusieurs certificats.

## 4. Déploiement automatique — clé SSH restreinte

Même modèle que Shede sur ce serveur partagé : la clé que GitHub Actions
utilise ne peut exécuter **qu'un seul script précis** côté serveur, jamais
une commande arbitraire — une clé compromise dans les secrets du dépôt ne
donne donc jamais un accès libre au VPS.

1. **Installer le script de déploiement sur le serveur** (copie de
   référence dans le dépôt : `deploy/scripts/deployer-tacynt-shop.sh`) :

   **[Serveur]**
   ```bash
   cp /home/etarcosdev/apps/tacynt-shop/deploy/scripts/deployer-tacynt-shop.sh /home/etarcosdev/scripts/
   chmod 700 /home/etarcosdev/scripts/deployer-tacynt-shop.sh
   ```

2. **Créer une clé SSH dédiée** (sans passphrase, GitHub Actions ne peut pas
   en saisir une) :

   **[PC]**
   ```powershell
   ssh-keygen -t ed25519 -f "$HOME\.ssh\github_actions_tacynt_shop" -N '""' -C "github-actions-tacynt-shop"
   ```

3. **Restreindre cette clé côté serveur**, dans `~/.ssh/authorized_keys` —
   ajouter une ligne (pas de retour à la ligne à l'intérieur) :

   ```
   command="/home/etarcosdev/scripts/deployer-tacynt-shop.sh $SSH_ORIGINAL_COMMAND",restrict <contenu-de-github_actions_tacynt_shop.pub>
   ```

   `restrict` désactive tout le reste (agent forwarding, port forwarding,
   pty…) ; `command=` force l'exécution du script quoi que le client
   demande, en lui passant ce qu'il a envoyé (`$SSH_ORIGINAL_COMMAND` — le
   SHA de commit, voir `.github/workflows/deploy.yml`) comme simple
   argument texte. Le script revalide lui-même que c'est bien un SHA avant
   d'y toucher.

   Vérifier : `ssh -i "$HOME\.ssh\github_actions_tacynt_shop" etarcosdev@169.58.213.108 "n'importe quoi"`
   doit exécuter le script de déploiement (ou refuser un commit invalide),
   **jamais** ouvrir une session libre ni exécuter `n'importe quoi` tel quel.

4. **Secrets GitHub** du dépôt (Settings → Secrets and variables → Actions) :
   - `SSH_HOST` = `169.58.213.108`
   - `SSH_USER` = `etarcosdev`
   - `SSH_PRIVATE_KEY` = contenu de `github_actions_tacynt_shop` (clé
     privée, jamais la `.pub`)
   - `VPS_KNOWN_HOSTS` n'est pas utilisé ici (`appleboy/ssh-action` gère sa
     propre vérification d'hôte) — si besoin d'y revenir, l'empreinte du
     serveur se génère **sur le serveur** depuis
     `/etc/ssh/ssh_host_ed25519_key.pub` (`ssh-keyscan` depuis Windows ne
     fonctionne pas avec la méthode KEX de ce serveur).

À partir de là, chaque push sur `main` déclenche automatiquement le
déploiement sur le serveur. Contrôle : onglet Actions du dépôt +
`tail ~/apps/deploiements.log` (même fichier que MedDoc/Shede) côté serveur.

## Vérification de bout en bout

- `https://shop.tacynt.com` → page marketing.
- Une inscription crée une organisation joignable en HTTPS valide sur
  `https://{slug}.shop.tacynt.com` en quelques secondes (domain-watcher).
- `https://shop.tacynt.com/platform/login` → espace admin plateforme
  (nécessite de créer le premier compte une fois, via le service `migrate` —
  voir les variables attendues dans scripts/create-platform-admin.ts) :
  ```bash
  cd /home/etarcosdev/apps/tacynt-shop
  sudo docker compose -f docker-compose.prod.yml --env-file .env.production run --rm \
    -e PLATFORM_ADMIN_EMAIL=... -e PLATFORM_ADMIN_PASSWORD=... \
    migrate npx tsx scripts/create-platform-admin.ts
  ```
- Un push sur `main` met le nouveau code en ligne sans intervention, et sans
  jamais perturber MedDoc (`meddoc.tacynt.com`) ni Shede (`shede.tacynt.com`).
- Si le healthcheck post-déploiement échoue, `deployer-tacynt-shop.sh`
  revient automatiquement à l'image applicative précédente (voir son
  en-tête) — vérifier `~/apps/deploiements.log` pour la raison, et si des
  migrations ont été appliquées avant l'échec (dans ce cas, revenir en
  arrière sur le schéma reste une décision manuelle, jamais automatique).

## Hors périmètre de ce document

- Sauvegardes automatisées de la base tacynt-shop (cahier des charges
  section 8 : quotidienne, rétention 30 jours) — à mettre en place avant un
  vrai lancement commercial, pas couvert ici. MedDoc et Shede ont déjà les
  leurs ; tacynt-shop n'en a pas encore.
- Registre d'images (GHCR) / build en CI — évolution possible si le VPS
  devient un goulot d'étranglement, pas nécessaire pour démarrer.
- Surveillance/alerting (Shede utilise Healthchecks.io) — pas encore mis en
  place pour tacynt-shop.
- Répartition sur plusieurs certificats au-delà de 100 boutiques (limite
  Let's Encrypt, voir section 3).
