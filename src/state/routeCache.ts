import { fetchForecast, type Forecast } from '../lib/openMeteo'
import { fetchTrack, trackFromPoints, type Track } from '../lib/routing'
import { forecastSites } from '../lib/sites'
import type { Route } from '../lib/types'
import { readBundle, writeBundle } from './persist'

/** Stažená data trasy. Trať je jednosměrná — návrat se k ní přidá až při výpočtu. */
export interface RouteBundle {
  track: Track
  forecast: Forecast
}

/** Předpověď starší než půl hodiny se při otevření stáhne znovu. */
export const FRESH_MS = 30 * 60 * 1000

const memory = new Map<string, { at: number; promise: Promise<RouteBundle> }>()

/**
 * Podpis trati: mění se jen s tím, kudy trasa vede. Start, tempo ani to,
 * jestli se jde i zpátky, stažená data neovlivní — návrat jde stejnými místy.
 */
export function signatureOf(route: Route): string {
  if (route.track && route.track.length > 1) {
    const t = route.track
    const mid = t[Math.floor(t.length / 2)]
    return `gpx|${t.length}|${[t[0], mid, t[t.length - 1]].map((p) => `${p.lat},${p.lon}`).join(';')}`
  }
  return route.waypoints
    .map((w) => `${w.lat.toFixed(5)},${w.lon.toFixed(5)},${Math.round(w.elevation)}`)
    .join(';')
}

const storeKey = (route: Route) => `route:${signatureOf(route)}`

async function trackOf(route: Route, signal?: AbortSignal): Promise<Track> {
  if (route.track && route.track.length > 1) return trackFromPoints(route.track, route.waypoints)
  // Trať se nemění, dokud se nezmění body. Vzdušná čára je nouzovka a zkusí se znovu.
  const cached = await readBundle<RouteBundle>(storeKey(route))
  if (cached?.track && !cached.track.fallback) return cached.track
  return fetchTrack(route.waypoints, signal)
}

/** Jedno stažení na trasu, sdílené mezi obrazovkami. `force` přeskočí paměť. */
export function loadRouteData(route: Route, force = false): Promise<RouteBundle> {
  const key = signatureOf(route)
  const hit = memory.get(key)
  if (!force && hit && Date.now() - hit.at < FRESH_MS) return hit.promise

  const promise = (async () => {
    const track = await trackOf(route)
    const forecast = await fetchForecast(forecastSites(track.points), 7)
    const bundle = { track, forecast }
    void writeBundle(storeKey(route), bundle)
    return bundle
  })()

  // Neúspěch se nesmí zacementovat v paměti, jinak by se to už nikdy nezkusilo.
  promise.catch(() => memory.delete(key))
  memory.set(key, { at: Date.now(), promise })
  return promise
}

/** Poslední uložená data trasy — na okamžité zobrazení a pro chvíle bez signálu. */
export function readCached(route: Route): Promise<RouteBundle | null> {
  return readBundle<RouteBundle>(storeKey(route))
}

export const storeKeyOf = storeKey
