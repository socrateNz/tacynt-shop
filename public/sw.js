// Service worker écrit à la main (pas de Workbox/next-pwa : ces outils
// s'intègrent via un plugin webpack, incompatible avec Turbopack — décision
// verrouillée en Phase 1). Portée : rendre toute l'app installable et
// permettre à la caisse de survivre à un démarrage à froid hors ligne, pas
// de cache "complet" des pages admin (données vivantes par nature).
const CACHE_VERSION = "v1";
const CACHE_NAME = `tacynt-shop-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline.html";

const PRECACHE_URLS = ["/offline.html", "/icons/icon-192.png", "/icons/icon-512.png"];

// Jamais mis en cache : API (mutations, synchro caisse) et écrans d'auth —
// une réponse de connexion ou de synchro périmée serait pire que rien.
const NEVER_CACHE_PREFIXES = ["/api/", "/login", "/signup"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function shouldBypass(url) {
  return NEVER_CACHE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== "GET" || url.origin !== self.location.origin || shouldBypass(url)) {
    return; // laisse passer sans intercepter
  }

  if (event.request.mode === "navigate") {
    // Network-first : contenu à jour quand la connexion existe, secours sur
    // le cache (peuplé par les visites précédentes) puis sur offline.html.
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Ne jamais mettre en cache une réponse en erreur (500, etc.) :
          // elle resterait servie hors ligne jusqu'au prochain bump de
          // version du cache, masquant un vrai problème serveur.
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() =>
          caches.match(event.request).then((cached) => cached || caches.match(OFFLINE_URL)),
        ),
    );
    return;
  }

  // Assets statiques (_next/static, icônes...) : cache-first, rafraîchi en
  // tâche de fond — c'est ce qui permet à /caisse de redémarrer à froid
  // hors ligne une fois visitée au moins une fois en ligne.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
