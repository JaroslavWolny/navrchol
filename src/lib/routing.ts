import { haversine } from './geo'
import type { Waypoint } from './types'

const BROUTER_URL = 'https://brouter.de/brouter'

/** Bod trati: zeměpisná šířka, délka a nadmořská výška ze SRTM. */
export interface TrackPoint {
  lat: number
  lon: number
  elevation: number
}

export interface Track {
  points: TrackPoint[]
  lengthKm: number
  ascentM: number
  descentM: number
  /** Index v `points`, kde trať míjí jednotlivé body trasy. */
  waypointIndices: number[]
  /** true = trať se nenašla a tohle je jen vzdušná čára mezi body. */
  fallback: boolean
}

interface BrouterGeoJson {
  features: Array<{
    geometry: { coordinates: Array<[number, number, number]> }
    properties: Record<string, string>
  }>
}

/**
 * Dopočítá skutečnou trasu po pěšinách mezi zadanými body.
 * Když veřejná služba nepojede, spadne se na vzdušnou čáru — appka nesmí kvůli tomu stát.
 */
export async function fetchTrack(waypoints: Waypoint[], signal?: AbortSignal): Promise<Track> {
  if (waypoints.length < 2) return straightLine(waypoints)

  try {
    const lonlats = waypoints.map((w) => `${w.lon.toFixed(6)},${w.lat.toFixed(6)}`).join('|')
    const url = `${BROUTER_URL}?lonlats=${encodeURIComponent(lonlats)}&profile=hiking-beta&alternativeidx=0&format=geojson`
    const res = await fetch(url, { signal })
    if (!res.ok) return straightLine(waypoints)

    const data = (await res.json()) as BrouterGeoJson
    const coords = data.features?.[0]?.geometry?.coordinates
    if (!coords || coords.length < 2) return straightLine(waypoints)

    const points: TrackPoint[] = coords.map(([lon, lat, ele]) => ({
      lat,
      lon,
      elevation: ele ?? 0,
    }))
    return finish(points, waypoints, false)
  } catch {
    return straightLine(waypoints)
  }
}

/** Nouzová varianta: rovné úsečky mezi body, výška lineárně mezi nimi. */
function straightLine(waypoints: Waypoint[]): Track {
  const points: TrackPoint[] = waypoints.map((w) => ({
    lat: w.lat,
    lon: w.lon,
    elevation: w.elevation,
  }))
  return finish(points, waypoints, true)
}

function finish(points: TrackPoint[], waypoints: Waypoint[], fallback: boolean): Track {
  let lengthKm = 0
  let ascentM = 0
  let descentM = 0
  for (let i = 1; i < points.length; i++) {
    lengthKm += haversine(points[i - 1], points[i])
    const dh = points[i].elevation - points[i - 1].elevation
    if (dh > 0) ascentM += dh
    else descentM -= dh
  }
  return {
    points,
    lengthKm,
    ascentM: Math.round(ascentM),
    descentM: Math.round(descentM),
    waypointIndices: waypoints.map((w) => nearestIndex(points, w)),
    fallback,
  }
}

/**
 * Trať tam i zpátky. Návrat po stejné pěšině není teleport: má vlastní čas
 * (Tobler počítá klesání jinak než stoupání), vlastní hodiny počasí a vlastní
 * riziko. Vrchol se neopakuje — obrátka je jeden bod, ne dva.
 */
export function withReturn(track: Track): Track {
  const n = track.points.length
  if (n < 2) return track

  const points = [...track.points, ...track.points.slice(0, -1).reverse()]
  // Bod, který byl na indexu i, leží po obrátce na 2·(n−1) − i.
  const back = track.waypointIndices
    .slice(0, -1)
    .reverse()
    .map((i) => 2 * (n - 1) - i)

  return {
    points,
    lengthKm: track.lengthKm * 2,
    ascentM: track.ascentM + track.descentM,
    descentM: track.descentM + track.ascentM,
    waypointIndices: [...track.waypointIndices, ...back],
    fallback: track.fallback,
  }
}

/** Ke kterému bodu trati je zadaný waypoint nejblíž. */
export function nearestIndex(points: TrackPoint[], target: { lat: number; lon: number }): number {
  let best = 0
  let bestDist = Infinity
  for (let i = 0; i < points.length; i++) {
    const d = haversine(points[i], target)
    if (d < bestDist) {
      bestDist = d
      best = i
    }
  }
  return best
}
