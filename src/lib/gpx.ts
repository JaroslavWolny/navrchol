import { cumulativeKm, haversine, smoothElevations } from './geo'
import { lookupElevations } from './elevation'
import type { TrackPoint, Waypoint } from './types'

export interface ParsedGpx {
  name: string
  points: Array<{ lat: number; lon: number; elevation: number | null }>
  /** Pojmenované body z GPX (vrcholy, chaty), pokud je autor trasy uložil. */
  marks: Array<{ name: string; lat: number; lon: number }>
}

const attr = (tag: string, name: string): number | null => {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([-+0-9.eE]+)["']`))
  return m ? Number(m[1]) : null
}

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim()

/**
 * GPX je jednoduché XML a appka z něj potřebuje tři věci: body trati, jejich
 * výšky a jména. Regulárními výrazy se to přečte stejně v prohlížeči jako
 * v testech, kde DOMParser není.
 */
export function parseGpx(xml: string): ParsedGpx {
  const pointRe = /<(trkpt|rtept)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/g
  const trk: ParsedGpx['points'] = []
  const rte: ParsedGpx['points'] = []
  for (const m of xml.matchAll(pointRe)) {
    const lat = attr(m[2], 'lat')
    const lon = attr(m[2], 'lon')
    if (lat === null || lon === null || !Number.isFinite(lat) || !Number.isFinite(lon)) continue
    const ele = m[3]?.match(/<ele>\s*([-+0-9.eE]+)\s*<\/ele>/)
    const point = { lat, lon, elevation: ele ? Number(ele[1]) : null }
    ;(m[1] === 'trkpt' ? trk : rte).push(point)
  }

  const marks: ParsedGpx['marks'] = []
  for (const m of xml.matchAll(/<wpt\b([^>]*?)>([\s\S]*?)<\/wpt>/g)) {
    const lat = attr(m[1], 'lat')
    const lon = attr(m[1], 'lon')
    const name = m[2].match(/<name>([\s\S]*?)<\/name>/)
    if (lat !== null && lon !== null && name) marks.push({ name: decode(name[1]), lat, lon })
  }

  // Jméno trasy: nejdřív trať, pak cesta, pak metadata.
  const named = (block: string | undefined) => block?.match(/<name>([\s\S]*?)<\/name>/)?.[1]
  const name =
    named(xml.match(/<trk\b[\s\S]*?<\/trk>/)?.[0]) ??
    named(xml.match(/<rte\b[\s\S]*?<\/rte>/)?.[0]) ??
    named(xml.match(/<metadata\b[\s\S]*?<\/metadata>/)?.[0]) ??
    ''

  return { name: decode(name), points: trk.length > 0 ? trk : rte, marks }
}

/**
 * Proředí záznam: body blíž než `minKm` od posledního ponechaného se zahodí.
 * Záznam z hodinek má bod každou vteřinu a pro předpověď ani profil to není
 * potřeba — jen by se tím plnila paměť telefonu.
 */
export function thin<T extends { lat: number; lon: number }>(points: T[], minKm: number): T[] {
  if (points.length < 3) return points
  const out = [points[0]]
  for (let i = 1; i < points.length - 1; i++) {
    if (haversine(out[out.length - 1], points[i]) >= minKm) out.push(points[i])
  }
  out.push(points[points.length - 1])
  return out
}

export interface ImportedRoute {
  name: string
  track: TrackPoint[]
  waypoints: Waypoint[]
  /** Start a cíl jsou na stejném místě — okruh, nebo cesta tam i zpět už v záznamu. */
  closed: boolean
}

/** Bod trati se stane bodem trasy; jméno se vezme z nejbližšího pojmenovaného místa v GPX. */
function markName(p: { lat: number; lon: number }, marks: ParsedGpx['marks'], fallback: string): string {
  let best: string | null = null
  let bestKm = 0.3
  for (const m of marks) {
    const d = haversine(p, m)
    if (d < bestKm) {
      bestKm = d
      best = m.name
    }
  }
  return best ?? fallback
}

/**
 * Z GPX udělá trať připravenou k plánování: proředí ji, doplní chybějící výšky
 * z modelu terénu a vyhladí šum. Body trasy jsou start, nejvyšší místo a cíl.
 */
export async function importGpx(xml: string, signal?: AbortSignal): Promise<ImportedRoute> {
  const parsed = parseGpx(xml)
  if (parsed.points.length < 2) throw new Error('V souboru není žádná trať.')

  const lengthKm = cumulativeKm(parsed.points).at(-1) ?? 0
  // Nejvýš ~1500 bodů, ale nikdy hustěji než po deseti metrech.
  const points = thin(parsed.points, Math.max(0.01, lengthKm / 1500))

  // Chybí výška u víc než desetiny bodů → celá trať se dotáhne z modelu terénu,
  // ať nejsou vedle sebe dvě různé výškové reference.
  const missing = points.filter((p) => p.elevation === null).length
  let elevations: number[]
  if (missing > points.length * 0.1) {
    const dem = await lookupElevations(points, signal)
    if (!dem) throw new Error('GPX nemá výšky a model terénu teď neodpovídá. Zkus to za chvíli.')
    elevations = dem
  } else {
    elevations = fillGaps(points.map((p) => p.elevation))
  }

  const track = smoothElevations(
    points.map((p, i) => ({ lat: p.lat, lon: p.lon, elevation: elevations[i] })),
  )

  const top = track.reduce((best, p, i) => (p.elevation > track[best].elevation ? i : best), 0)
  const first = track[0]
  const last = track[track.length - 1]
  const closed = haversine(first, last) < 0.2

  const at = (i: number, fallback: string, id: string): Waypoint => ({
    id,
    name: markName(track[i], parsed.marks, fallback),
    lat: track[i].lat,
    lon: track[i].lon,
    elevation: Math.round(track[i].elevation),
  })

  const waypoints: Waypoint[] = [at(0, 'Start', 'gpx-start')]
  if (top !== 0 && top !== track.length - 1) waypoints.push(at(top, 'Nejvyšší bod', 'gpx-top'))
  waypoints.push(at(track.length - 1, closed ? 'Zpět na startu' : 'Cíl', 'gpx-end'))

  return {
    name: parsed.name || waypoints[waypoints.length > 2 ? 1 : 0].name,
    track: track.map((p) => ({
      lat: Math.round(p.lat * 1e6) / 1e6,
      lon: Math.round(p.lon * 1e6) / 1e6,
      elevation: Math.round(p.elevation * 10) / 10,
    })),
    waypoints,
    closed,
  }
}

/** Díry ve výškách dorovná lineárně mezi sousedy. */
function fillGaps(values: Array<number | null>): number[] {
  const out = values.map((v) => (v === null ? NaN : v))
  const known = out.map((v, i) => (Number.isNaN(v) ? -1 : i)).filter((i) => i >= 0)
  if (known.length === 0) return out.map(() => 0)
  for (let i = 0; i < out.length; i++) {
    if (!Number.isNaN(out[i])) continue
    const prev = [...known].reverse().find((k) => k < i)
    const next = known.find((k) => k > i)
    if (prev === undefined) out[i] = out[next!]
    else if (next === undefined) out[i] = out[prev]
    else out[i] = out[prev] + ((out[next] - out[prev]) * (i - prev)) / (next - prev)
  }
  return out
}
