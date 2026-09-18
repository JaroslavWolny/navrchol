import { haversine } from './geo'
import type { PaceKey, Route, Waypoint } from './types'

const PACE_FACTOR: Record<PaceKey, number> = {
  pomale: 0.8,
  stredni: 1,
  svizne: 1.25,
}

/**
 * Toblerova funkce chůze: rychlost v km/h podle sklonu (převýšení / vodorovná vzdálenost).
 * Maximum je na mírném klesání -5 %, ne na rovině — proto ten posun o 0,05.
 */
export function toblerSpeed(slope: number): number {
  return 6 * Math.exp(-3.5 * Math.abs(slope + 0.05))
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
  }
}

/** "4 h 20 min", nebo "45 min" když je to pod hodinu. */
export function formatDuration(minutes: number): string {
  const total = Math.round(minutes)
  const h = Math.floor(total / 60)
  const m = total % 60
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`
}

/**
 * Plán počítaný po skutečné trati: Tobler se aplikuje na každý úsek pěšiny zvlášť,
 * takže serpentýny i prudké stoupání se do času promítnou tak, jak se opravdu jdou.
 */
export function planFromTrack(
  track: { points: Array<{ lat: number; lon: number; elevation: number }>; waypointIndices: number[] },
  route: Route,
  day: Date,
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
    const speed = toblerSpeed(slope) * factor
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
  }
}
