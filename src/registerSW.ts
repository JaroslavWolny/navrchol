/**
 * Registrace service workeru plus záchranná brzda.
 * Když se po nasazení „nic nezměnilo", skoro vždycky za to může zaseklý
 * service worker — otevři appku s ?clear-sw=1 a všechno se vyčistí.
 */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return

  const params = new URLSearchParams(location.search)
  if (params.has('clear-sw')) {
    void (async () => {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((r) => r.unregister()))
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      }
      location.replace(location.pathname)
    })()
    return
  }

  if (import.meta.env.DEV) return

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Bez service workeru appka běží dál, jen nepojede offline.
    })
  })
}
