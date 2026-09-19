import { haversine } from './geo'
import type { PaceKey, Route, Waypoint } from './types'

const PACE_FACTOR: Record<PaceKey, number> = {
  pomale: 0.8,
  stredni: 1,
  svizne: 1.25,
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * Toblerova funkce chůze: rychlost v km/h podle sklonu (převýšení / vodorovná vzdálenost).
 * Maximum je na mírném klesání -5 %, ne na rovině — proto ten posun o 0,05.
 */
export function toblerSpeed(slope: number): number {
  return 6 * Math.exp(-3.5 * Math.abs(slope + 0.05))
}

/**
 * Prošlapávání. Do patnácti centimetrů se jde normálně, po kolena ve neprošlapaném
 * sněhu spadne rychlost na třetinu — v Krkonoších v zimě je to rozdíl několika hodin,
 * a tedy i rozdíl mezi návratem za světla a návratem po tmě.
 */
export function snowFactor(depthM: number): number {
  if (depthM <= 0.15) return 1
  return clamp(1 - (depthM - 0.15) * 1.6, 0.35, 1)
}

/** Výška sněhu v dané nadmořské výšce. */
export type SnowProfile = (elevation: number) => number

/**
 * Sníh měřený v bodech trasy přepočtený na výšku: v údolí nemusí ležet nic,
 * na hřebeni půl metru, a průměr z toho by lhal oběma směrům.
 */
export function snowProfileOf(samples: Array<{ elevation: number; depthM: number }>): SnowProfile {
  const sorted = [...samples].sort((a, b) => a.elevation - b.elevation)
  if (sorted.length === 0) return () => 0

  return (elevation: number) => {
    if (elevation <= sorted[0].elevation) return sorted[0].depthM
    const last = sorted[sorted.length - 1]
    if (elevation >= last.elevation) return last.depthM
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1]
      const b = sorted[i]
      if (elevation <= b.elevation) {
        const span = b.elevation - a.elevation
        const t = span > 0 ? (elevation - a.elevation) / span : 0
        return a.depthM + (b.depthM - a.depthM) * t
      }
    }
    return last.depthM
  }
}

export interface Leg {
  from: Waypoint
  to: Waypoint
  distanceKm: number
  ascentM: number
  descentM: number
  minutes: number
}

export interface Arrival {
  waypoint: Waypoint
  at: Date
  /** Minut od startu. */
  offsetMin: number
}

export interface RoutePlan {
  legs: Leg[]
  arrivals: Arrival[]
  distanceKm: number
  ascentM: number
  descentM: number
  minutes: number
  /** Kumulativní čas v minutách ke každému bodu trati. Prázdné bez trati. */
  elapsed: number[]
}

/** Rozloží trasu na úseky mezi sousedními body a spočítá, jak dlouho každý zabere. */
export function legsOf(route: Route): Leg[] {
  const factor = PACE_FACTOR[route.pace]
  const out: Leg[] = []
  for (let i = 0; i < route.waypoints.length - 1; i++) {
    const from = route.waypoints[i]
    const to = route.waypoints[i + 1]
    const distanceKm = haversine(from, to)
    const dh = to.elevation - from.elevation
    // Nulová vzdálenost by dala nekonečný sklon; takový úsek prostě netrvá nic.
    const slope = distanceKm > 0 ? dh / (distanceKm * 1000) : 0
    const speed = toblerSpeed(slope) * factor
    out.push({
      from,
      to,
      distanceKm,
      ascentM: Math.max(0, dh),
      descentM: Math.max(0, -dh),
      minutes: speed > 0 ? (distanceKm / speed) * 60 : 0,
    })
  }
  return out
}

/** Naparsuje "HH:MM" na daný den v lokálním čase. */
export function startOf(day: Date, startTime: string): Date {
  const [h, m] = startTime.split(':').map(Number)
  const d = new Date(day)
  d.setHours(h, m ?? 0, 0, 0)
  return d
}

export function planRoute(route: Route, day: Date): RoutePlan {
  const ls = legsOf(route)
  const start = startOf(day, route.startTime)

  const arrivals: Arrival[] = []
  let offsetMin = 0
  if (route.waypoints.length > 0) {
    arrivals.push({ waypoint: route.waypoints[0], at: new Date(start), offsetMin: 0 })
  }
  for (const leg of ls) {
    offsetMin += leg.minutes
    arrivals.push({
      waypoint: leg.to,
      at: new Date(start.getTime() + offsetMin * 60000),
      offsetMin,
    })
  }

  return {
    legs: ls,
    arrivals,
    distanceKm: ls.reduce((s, l) => s + l.distanceKm, 0),
    ascentM: ls.reduce((s, l) => s + l.ascentM, 0),
    descentM: ls.reduce((s, l) => s + l.descentM, 0),
    minutes: offsetMin,
    elapsed: [],
  }
}

/** "4 h 20 min", nebo "45 min" když je to pod hodinu. */
export function formatDuration(minutes: number): string {
  const total = Math.round(minutes)
  const h = Math.floor(total / 60)
  const m = total % 60
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`
}

interface TrackLike {
  points: Array<{ lat: number; lon: number; elevation: number }>
  waypointIndices: number[]
}

/**
 * Plán počítaný po skutečné trati: Tobler se aplikuje na každý úsek pěšiny zvlášť,
 * takže serpentýny i prudké stoupání se do času promítnou tak, jak se opravdu jdou.
 * Když leží sníh, každý úsek se navíc zpomalí podle výšky sněhu v jeho nadmořské výšce.
 */
export function planFromTrack(
  track: TrackLike,
  route: Route,
  day: Date,
  snow?: SnowProfile,
): RoutePlan {
  const factor = PACE_FACTOR[route.pace]
  const { points } = track

  // Kumulativní čas v minutách ke každému bodu trati.
  const elapsed: number[] = new Array(points.length).fill(0)
  let distanceKm = 0
  let ascentM = 0
  let descentM = 0

  for (let i = 1; i < points.length; i++) {
    const segKm = haversine(points[i - 1], points[i])
    const dh = points[i].elevation - points[i - 1].elevation
    const slope = segKm > 0 ? dh / (segKm * 1000) : 0
    const speed = toblerSpeed(slope) * factor * (snow ? snowFactor(snow(points[i].elevation)) : 1)
    elapsed[i] = elapsed[i - 1] + (speed > 0 ? (segKm / speed) * 60 : 0)
    distanceKm += segKm
    if (dh > 0) ascentM += dh
    else descentM -= dh
  }

  const start = startOf(day, route.startTime)
  const arrivals: Arrival[] = route.waypoints.map((waypoint, i) => {
    const idx = track.waypointIndices[i] ?? 0
    const offsetMin = elapsed[idx] ?? 0
    return { waypoint, at: new Date(start.getTime() + offsetMin * 60000), offsetMin }
  })

  return {
    legs: legsOf(route),
    arrivals,
    distanceKm,
    ascentM: Math.round(ascentM),
    descentM: Math.round(descentM),
    minutes: elapsed[elapsed.length - 1] ?? 0,
    elapsed,
  }
}

/**
 * Za jak dlouho se z daného místa trati dostaneš pod hranici exponovaného terénu.
 * Bere kratší z obou směrů — před bouřkou je jedno, jestli seběhneš dopředu nebo zpátky,
 * důležité je, jak dlouho budeš ještě na hřebeni. Bez tohohle čísla je „buď dole
 * do poledne" jen fráze.
 */
export function exitMinutes(
  track: TrackLike,
  fromIndex: number,
  exposedAbove: number,
  pace: PaceKey,
  snow?: SnowProfile,
): number {
  const factor = PACE_FACTOR[pace]
  const { points } = track
  if (points.length === 0) return 0
  const from = clamp(Math.round(fromIndex), 0, points.length - 1)
  if (points[from].elevation < exposedAbove) return 0

  const walk = (step: 1 | -1): number => {
    let minutes = 0
    for (let i = from; step > 0 ? i < points.length - 1 : i > 0; i += step) {
      const a = points[i]
      const b = points[i + step]
      const segKm = haversine(a, b)
      const dh = b.elevation - a.elevation
      const slope = segKm > 0 ? dh / (segKm * 1000) : 0
      const speed = toblerSpeed(slope) * factor * (snow ? snowFactor(snow(b.elevation)) : 1)
      minutes += speed > 0 ? (segKm / speed) * 60 : 0
      if (b.elevation < exposedAbove) return minutes
    }
    return Infinity
  }

  return Math.min(walk(1), walk(-1))
}
