const CACHE_NAME = 'listinglint-shell-v4'
const CORE_ASSETS = [
  './manifest.webmanifest',
  './favicon.svg',
  './icon-192.png',
  './icon-512.png',
  './listinglint-demo-images.zip',
  './listinglint-work-template.xlsx'
]

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME)
  const rootUrl = new URL('./', self.registration.scope)
  const rootResponse = await fetch(rootUrl)
  const html = await rootResponse.clone().text()
  const linkedAssets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => new URL(match[1], rootUrl).href)
    .filter((url) => url.startsWith(self.registration.scope))
  const assets = [...new Set([
    ...CORE_ASSETS.map((path) => new URL(path, rootUrl).href),
    ...linkedAssets
  ])]

  await cache.put(rootUrl, rootResponse)
  await cache.addAll(assets)
}

self.addEventListener('install', (event) => {
  event.waitUntil(cacheAppShell())
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  )
  self.clients.claim()
})

async function fetchAndCache(request) {
  const response = await fetch(request)
  if (response.ok) {
    await caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()))
  }
  return response
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetchAndCache(request).catch(() => caches.match(new URL('./', self.registration.scope)))
    )
    return
  }

  if (url.pathname.includes('/assets/')) {
    event.respondWith(
      caches.match(request, { ignoreVary: true }).then((cached) => cached ?? fetchAndCache(request))
    )
    return
  }

  event.respondWith(fetchAndCache(request).catch(() => caches.match(request, { ignoreVary: true })))
})
