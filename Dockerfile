# Prisma 7 utilise des driver adapters (@prisma/adapter-pg) — pas de moteur
# de requête binaire Rust à gérer entre build et runtime, contrairement aux
# anciennes versions de Prisma. @node-rs/argon2 a un binaire précompilé pour
# linux-x64-musl (alpine) : image cohérente d'un bout à l'autre du build.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# npm ci installe aussi xlsx depuis cdn.sheetjs.com (jamais le paquet npm
# vulnérable) — nécessite un accès réseau sortant pendant le build, comme en dev.
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Valeurs factices, uniquement pour que `prisma generate` (prisma.config.ts
# exige DATABASE_URL) et `next build` (les clients Prisma sont construits au
# chargement du module, potentiellement touchés par l'analyse statique des
# routes) ne plantent pas — aucune connexion réelle n'a lieu au build,
# écrasées par les vraies valeurs de docker-compose.prod.yml au runtime.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV RUNTIME_DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV APP_ROOT_DOMAIN="shop.tacynt.com"
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Traçage de dépendances de `output: standalone` : peut manquer le dossier
# .prisma généré dynamiquement par `prisma generate` — copie explicite par
# précaution (recommandation Prisma pour un déploiement Next.js standalone).
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q --spider http://localhost:3000/ || exit 1

CMD ["node", "server.js"]
