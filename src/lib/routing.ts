import { climb, cumulativeKm, densify, haversine } from './geo'
import { lookupElevations } from './elevation'
import type { TrackPoint, Waypoint } from './types'

export type { TrackPoint } from './types'

const BROUTER_URL = 'https://brouter.de/brouter'

export interface Track {
  points: TrackPoint[]
  lengthKm: number
  ascentM: number
  descentM: number
  /** Index v `points`, kde trať míjí jednotlivé body trasy. */
  waypointIndices: number[]
  /** true = trať se nenašla a tohle je jen vzdušná čára mezi body. */
  fallback: boolean
  /** Trať je z importovaného GPX, jde se přesně tudy. */
  fromGpx?: boolean
  /** U túry tam a zpět index obrátky; za ním už je cesta zpátky. */
  turnIndex?: number
}

interface BrouterGeoJson {
  features: Array<{
    geometry: { coordinates: Array<[number, number, number]> }
    properties: Record<string, string>
  }>
}

/**
 * Dopočítá skutečnou trasu po pěšinách mezi zadanými body.
 * Když veřejná služba nepojede, spadne se na vzdušnou čáru — ale s výškami
 * terénu po cestě, ne jen s výškami koncových bodů. Jinak by hřeben mezi
 * dvěma sedly zmizel z profilu i z předpovědi.
 */
export async function fetchTrack(waypoints: Waypoint[], signal?: AbortSignal): Promise<Track> {
  if (waypoints.length < 2) return straightLine(waypoints)

  try {
    const lonlats = waypoints.map((w) => `${w.lon.toFixed(6)},${w.lat.toFixed(6)}`).join('|')
    const url = `${BROUTER_URL}?lonlats=${encodeURIComponent(lonlats)}&profile=hiking-beta&alternativeidx=0&format=geojson`
    const res = await fetch(url, { signal })
    if (res.ok) {
      const data = (await res.json()) as BrouterGeoJson
      const coords = data.features?.[0]?.geometry?.coordinates
      if (coords && coords.length >= 2) {
        const points: TrackPoint[] = coords.map(([lon, lat, ele]) => ({ lat, lon, elevation: ele ?? 0 }))
        return finish(points, waypointIndicesOf(points, waypoints), false)
      }
    }
  } catch (e) {
    if (signal?.aborted) throw e
  }
  return terrainLine(waypoints, signal)
}

/** Vzdušná čára s výškami terénu každých pár set metrů. */
async function terrainLine(waypoints: Waypoint[], signal?: AbortSignal): Promise<Track> {
  const totalKm = waypoints.slice(1).reduce((s, w, i) => s + haversine(waypoints[i], w), 0)
  // Tři sta bodů je tři dotazy na výšky; delší úsečky se vzorkují řidčeji.
  const step = Math.max(0.15, totalKm / 300)

  const points: TrackPoint[] = []
  const indices: number[] = [0]
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i]
    const b = waypoints[i + 1]
    const seg = densify(a, b, step)
    for (const p of i === 0 ? seg : seg.slice(1)) {
      points.push({ lat: p.lat, lon: p.lon, elevation: a.elevation + (b.elevation - a.elevation) * p.t })
    }
    indices.push(points.length - 1)
  }

  const dem = await lookupElevations(points, signal)
  if (dem) {
    dem.forEach((e, i) => (points[i].elevation = e))
    // Body trasy mají výšku zadanou člověkem nebo z geokódování — ta vyhraje.
    indices.forEach((idx, k) => (points[idx].elevation = waypoints[k].elevation))
  }
  return finish(points, indices, true)
}

/** Nouzová varianta bez sítě: rovné úsečky mezi body. */
function straightLine(waypoints: Waypoint[]): Track {
  const points: TrackPoint[] = waypoints.map((w) => ({ lat: w.lat, lon: w.lon, elevation: w.elevation }))
  return finish(points, waypoints.map((_, i) => i), true)
}

/** Trať z GPX: body jsou dané, jen se k nim dopočítají souhrny. */
export function trackFromPoints(points: TrackPoint[], waypoints: Waypoint[]): Track {
  return { ...finish(points, waypointIndicesOf(points, waypoints), false), fromGpx: true }
}

function finish(points: TrackPoint[], waypointIndices: number[], fallback: boolean): Track {
  const cum = cumulativeKm(points)
  const { ascent, descent } = climb(points.map((p) => p.elevation))
  return {
    points,
    lengthKm: cum[cum.length - 1] ?? 0,
    ascentM: ascent,
    descentM: descent,
    waypointIndices,
    fallback,
  }
}

/**
 * Kde trať míjí body trasy. Hledá se postupně od posledního nalezeného bodu,
 * ne po celé trati — u okruhu je cíl na stejném místě jako start a hledání
 * po celé trati by ho našlo na začátku, takže by túra „skončila" v čase nula.
 */
export function waypointIndicesOf(points: TrackPoint[], waypoints: Waypoint[]): number[] {
  const out: number[] = []
  let from = 0
  for (const w of waypoints) {
    const i = nearestIndex(points, w, from)
    out.push(i)
    from = i
  }
  return out
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
    ...track,
    points,
    lengthKm: track.lengthKm * 2,
    ascentM: track.ascentM + track.descentM,
    descentM: track.descentM + track.ascentM,
    waypointIndices: [...track.waypointIndices, ...back],
    turnIndex: n - 1,
  }
}

/** Ke kterému bodu trati (od indexu `from` dál) je zadané místo nejblíž. */
export function nearestIndex(
  points: Array<{ lat: number; lon: number }>,
  target: { lat: number; lon: number },
  from = 0,
): number {
  let best = from
  let bestDist = Infinity
  for (let i = from; i < points.length; i++) {
    const d = haversine(points[i], target)
    // Ostře menší: ze stejně vzdálených bodů vyhraje ten dřívější.
    if (d < bestDist - 0.005) {
      bestDist = d
      best = i
    }
  }
  return best
}
