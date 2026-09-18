import { fetchForecast, type Forecast } from '../lib/openMeteo'
import { fetchTrack, type Track } from '../lib/routing'
import type { Route } from '../lib/types'

export interface RouteBundle {
  track: Track
  forecast: Forecast
}

interface Entry {
  at: number
  promise: Promise<RouteBundle>
}

const cache = new Map<string, Entry>()
/** Předpověď starší než půl hodiny už nemá cenu držet. */
const TTL_MS = 30 * 60 * 1000

/** Podpis trasy se mění jen s body. Start ani tempo stažená data neovlivní. */
export function signatureOf(route: Route): string {
  return route.waypoints
    .map((w) => `${w.lat.toFixed(5)},${w.lon.toFixed(5)},${Math.round(w.elevation)}`)
    .join(';')
}

/** Jedno stažení na trasu, sdílené mezi obrazovkami. */
export function loadRouteData(route: Route, signal?: AbortSignal): Promise<RouteBundle> {
  const key = signatureOf(route)
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.promise

  const promise = Promise.all([
    fetchTrack(route.waypoints, signal),
    fetchForecast(route.waypoints, 7, signal),
  ]).then(([track, forecast]) => ({ track, forecast }))

  // Neúspěch se nesmí zacementovat v cache, jinak by se to už nikdy nezkusilo.
  promise.catch(() => cache.delete(key))
  cache.set(key, { at: Date.now(), promise })
  return promise
}

/** Kdy se data pro trasu naposled stáhla. Předpověď bez data stáří se nedá vážit. */
export function cachedAt(route: Route): number | null {
  return cache.get(signatureOf(route))?.at ?? null
}

export function invalidate(route: Route): void {
  cache.delete(signatureOf(route))
}
