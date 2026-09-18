/**
 * Registrace service workeru a hlídání, že na telefonu neběží stará verze.
 *
 * Na iOS se appka přidaná na plochu sama neaktualizuje: má vlastní úložiště
 * oddělené od Safari (takže `?clear-sw=1` otevřený v Safari na ni nemá vliv)
 * a po probuzení se často obnoví z paměti, aniž by sáhla na síť. Tester tak
 * hlásí chyby, které jsou dávno opravené.
 *
 * Proto se při každém návratu do appky stáhne mimo cache malý soubor s číslem
 * verze. Když se liší od zabudovaného, appka se sama načte znovu.
 */
export function registerServiceWorker(): void {
  const params = new URLSearchParams(location.search)
  if (params.has('clear-sw')) {
    void clearEverything()
    return
  }

  if (import.meta.env.DEV) return

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Bez service workeru appka běží dál, jen nepojede offline.
      })
    })

    // Nová verze převzala řízení — stránka musí na ni přeskočit.
    let reloading = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return
      reloading = true
      location.reload()
    })
  }

  void checkForUpdate()
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkForUpdate()
  })
}

let checking = false

async function checkForUpdate(): Promise<void> {
  if (checking) return
  checking = true
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return
    const data = (await res.json()) as { version?: string }
    if (data.version && data.version !== __BUILD_ID__) {
      const registrations = await navigator.serviceWorker?.getRegistrations?.()
      await Promise.all((registrations ?? []).map((r) => r.update().catch(() => undefined)))
      location.reload()
      return
    }
    // Verze sedí, ale service worker si o novou stejně jednou za návrat řekne.
    const registration = await navigator.serviceWorker?.getRegistration?.()
    await registration?.update().catch(() => undefined)
  } catch {
    // Offline nebo výpadek — appka běží dál na tom, co má.
  } finally {
    checking = false
  }
}

/** Úplný úklid: odregistruje service worker a smaže všechny cache. */
async function clearEverything(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((r) => r.unregister()))
    }
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
  } finally {
    location.replace(location.pathname)
  }
}
