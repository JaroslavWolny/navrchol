// Verzi zvyš při každém vydání — vynutí to zahození starých cache.
const VERSION = 'navrchol-v11'

self.addEventListener('install', (event) => {
  // Nová verze se nesmí schovávat za starou. Zastaralý service worker je
  // nejčastější důvod, proč „nasazená změna není vidět".
  self.skipWaiting()
  event.waitUntil(
    caches.open(VERSION).then(async (cache) => {
      await cache.addAll(['/', '/manifest.webmanifest', '/icon.svg', '/icon-180.png'])
      // Skripty a styly mají v názvu otisk obsahu a jejich seznam je jen v index.html.
      // Bez nich by první spuštění na hřebeni bez signálu skončilo prázdnou stránkou.
      const page = await cache.match('/')
      const html = page ? await page.text() : ''
      const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1])
      await cache.addAll(assets)
    }),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'clear') {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))),
    )
  }
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // Soubor s číslem verze musí vždy z sítě, jinak by appka nikdy nepoznala,
  // že běží na staré verzi.
  if (url.pathname === '/version.json') return
  // Předpověď se přes service worker necachuje: appka si ji ukládá sama do IndexedDB
  // i s časem stažení, takže offline ukáže poslední předpověď a řekne, jak je stará.
  if (url.hostname.endsWith('open-meteo.com') || url.hostname.endsWith('brouter.de')) return

  // Všude jinde nejdřív síť, cache je záloha pro offline.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && (url.origin === self.location.origin || url.hostname.includes('tile'))) {
          const copy = response.clone()
          caches.open(VERSION).then((cache) => cache.put(request, copy))
        }
        return response
      })
      .catch(() =>
        caches.match(request).then((hit) => hit ?? caches.match('/').then((r) => r ?? Response.error())),
      ),
  )
})
