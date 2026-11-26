/*
 * Service worker : permet d'ouvrir l'application sans réseau (sur un toit,
 * en zone blanche) une fois qu'elle a été chargée au moins une fois.
 *
 * - Page d'accueil (navigation) : réseau d'abord, cache si hors ligne.
 * - Fichiers de l'application (même origine) : cache d'abord. Leurs noms
 *   changent à chaque version (hash), donc pas de risque de version périmée.
 * - Requêtes vers d'autres sites (fonds IGN, géocodage) : jamais mises en cache.
 */
const CACHE = 'dronereport-v1'

self.addEventListener('install', (event) => {
  // Pré-charge la coquille de l'application
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest', './favicon.svg'])))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  // Supprime les caches des versions précédentes
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put('./index.html', copy))
          return res
        })
        .catch(() => caches.match('./index.html')),
    )
    return
  }

  event.respondWith(
    caches.match(req).then((hit) =>
      hit ||
      fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy))
        }
        return res
      }),
    ),
  )
})
