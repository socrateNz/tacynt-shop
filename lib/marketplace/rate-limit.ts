import { NextResponse } from "next/server";

import { clientIp } from "@/lib/marketplace/auth";

// Limite par adresse IP sur les routes d'authentification Sodu, en mémoire
// (fenêtre glissante). Complément du verrouillage par compte en base
// (lib/marketplace/auth.ts) : freine un même client qui tente sa chance sur
// beaucoup de comptes différents. Volontairement simple — par instance
// serveur, remis à zéro au redémarrage ; suffisant pour un déploiement
// mono-instance, à remplacer par un stockage partagé (Redis) si l'app
// passe un jour sur plusieurs instances.
type Bucket = number[];

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

function sweep(now: number, windowMs: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, hits] of buckets) {
    if (hits.length === 0 || now - hits[hits.length - 1]! > windowMs) buckets.delete(key);
  }
}

export type RateLimitRule = { name: string; max: number; windowMs: number };

export const AUTH_RULES = {
  login: { name: "login", max: 20, windowMs: 15 * 60_000 },
  register: { name: "register", max: 10, windowMs: 60 * 60_000 },
  code: { name: "code", max: 30, windowMs: 15 * 60_000 },
} satisfies Record<string, RateLimitRule>;

// Renvoie une réponse 429 si la limite est dépassée, sinon null (et
// comptabilise la tentative).
export function rateLimit(request: Request, rule: RateLimitRule): NextResponse | null {
  const ip = clientIp(request) ?? "inconnue";
  const key = `${rule.name}:${ip}`;
  const now = Date.now();
  sweep(now, rule.windowMs);

  const hits = (buckets.get(key) ?? []).filter((t) => now - t < rule.windowMs);
  if (hits.length >= rule.max) {
    buckets.set(key, hits);
    const retryAfter = Math.ceil((rule.windowMs - (now - hits[0]!)) / 1000);
    return NextResponse.json(
      { error: "Trop de tentatives depuis cette connexion. Réessayez un peu plus tard.", retryAfter },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }
  hits.push(now);
  buckets.set(key, hits);
  return null;
}
