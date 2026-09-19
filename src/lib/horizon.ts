import { sunPosition } from './sun'

/**
 * Skutečný obzor, ne ten z tabulek.
 *
 * Astronomický východ počítá s rovnou plochou. V horách slunce vyleze až nad
 * protější hřeben — v sedle nebo v údolí klidně o půl hodiny později, a přesně
 * tenhle rozdíl rozhoduje, jestli má cenu vstávat ve čtyři, nebo v pět.
 * Terén se ohmatá výškami podél azimutu (Open-Meteo Elevation, bez klíče).
 */

const R_EARTH_M = 6_371_000
const RAD = Math.PI / 180

/** Kam dojdeš, když z bodu vyrazíš daným azimutem na danou vzdálenost. */
export function destination(
  from: { lat: number; lon: number },
  bearing: number,
  distanceKm: number,
): { lat: number; lon: number } {
  const delta = (distanceKm * 1000) / R_EARTH_M
  const theta = bearing * RAD
  const phi1 = from.lat * RAD
  const lambda1 = from.lon * RAD

  const phi2 = Math.asin(
    Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta),
  )
  const lambda2 =
    lambda1 +
    Math.atan2(
      Math.sin(theta) * Math.sin(delta) * Math.cos(phi1),
      Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2),
    )
  return { lat: phi2 / RAD, lon: (((lambda2 / RAD + 540) % 360) - 180) }
}

/**
 * Jak hluboko pod tečnou leží bod ve vzdálenosti d kvůli zakřivení Země.
 * Refrakce v přízemní vrstvě zakřivení zdánlivě zmenšuje, proto ten koeficient 7/6.
 */
const curvatureDrop = (distanceKm: number) =>
  (distanceKm * 1000) ** 2 / (2 * R_EARTH_M * (7 / 6))

/** Kde se obzor ohmatává. Blízko hustě, daleko řídce — vzdálený kopec je plochý. */
const DISTANCES_KM = [0.3, 0.6, 1, 1.5, 2, 3, 4, 5, 6.5, 8, 10, 13, 16, 20, 25]

/** Nejvyšší překážka v jednom azimutu. */
export interface HorizonPoint {
  azimuth: number
  /** Úhlová výška obzoru ve stupních. Záporná = díváš se dolů (jsi na vrcholu). */
  angle: number
  distanceKm: number
  elevation: number
}

export interface Horizon {
  points: HorizonPoint[]
  /** Úhel obzoru v libovolném azimutu, dopočítaný mezi změřenými. */
  angleAt: (azimuth: number) => number
}

const ELEVATION_URL = 'https://api.open-meteo.com/v1/elevation'
/** Kolik souřadnic snese jeden dotaz. */
const BATCH = 90

/**
 * Změří obzor v zadaných azimutech. Když se výšky nestáhnou, vrátí null —
 * appka pak ukazuje astronomické časy a řekne, že terén nezná.
 */
export async function fetchHorizon(
  from: { lat: number; lon: number; elevation: number },
  azimuths: number[],
  signal?: AbortSignal,
): Promise<Horizon | null> {
  const probes = azimuths.flatMap((azimuth) =>
    DISTANCES_KM.map((distanceKm) => ({ azimuth, distanceKm, ...destination(from, azimuth, distanceKm) })),
  )

  const elevations: number[] = []
  try {
    for (let i = 0; i < probes.length; i += BATCH) {
      const chunk = probes.slice(i, i + BATCH)
      const url =
        `${ELEVATION_URL}?latitude=${chunk.map((p) => p.lat.toFixed(5)).join(',')}` +
        `&longitude=${chunk.map((p) => p.lon.toFixed(5)).join(',')}`
      const res = await fetch(url, { signal })
      if (!res.ok) return null
      const data = (await res.json()) as { elevation?: number[] }
      if (!data.elevation || data.elevation.length !== chunk.length) return null
      elevations.push(...data.elevation)
    }
  } catch {
    return null
  }

  const best = new Map<number, HorizonPoint>()
  probes.forEach((probe, i) => {
    const rise = elevations[i] - from.elevation - curvatureDrop(probe.distanceKm)
    const angle = Math.atan2(rise, probe.distanceKm * 1000) / RAD
    const current = best.get(probe.azimuth)
    if (!current || angle > current.angle) {
      best.set(probe.azimuth, {
        azimuth: probe.azimuth,
        angle,
        distanceKm: probe.distanceKm,
        elevation: elevations[i],
      })
    }
  })

  const points = [...best.values()].sort((a, b) => a.azimuth - b.azimuth)
  return { points, angleAt: (azimuth) => interpolate(points, azimuth) }
}

/** Mezi změřenými azimuty se úhel dopočítá lineárně, dokola přes sever. */
function interpolate(points: HorizonPoint[], azimuth: number): number {
  if (points.length === 0) return 0
  if (points.length === 1) return points[0].angle
  const a = (((azimuth % 360) + 360) % 360)

  let before = points[points.length - 1]
  let after = points[0]
  for (let i = 0; i < points.length; i++) {
    if (points[i].azimuth <= a) before = points[i]
    if (points[i].azimuth >= a) {
      after = points[i]
      break
    }
  }
  const span = (((after.azimuth - before.azimuth) % 360) + 360) % 360
  if (span === 0) return before.angle
  const offset = (((a - before.azimuth) % 360) + 360) % 360
  return before.angle + (after.angle - before.angle) * (offset / span)
}

export interface TerrainEvent {
  /** Kdy slunce vyleze nad terén (nebo za něj spadne). */
  at: Date
  /** O kolik minut později než nad rovným obzorem. */
  delayMin: number
  /** Co ho drží — vzdálenost a výška nejvyšší překážky v tom směru. */
  blocker: HorizonPoint | null
}

/**
 * Kdy slunce doopravdy vyleze nad hřeben a kdy za něj zapadne.
 * Prochází se po minutách: v každé se ví, kde slunce je, a porovná se s obzorem
 * přesně v tom azimutu — kopec o dvacet stupňů vedle je fotografovi k ničemu.
 */
export interface TerrainSun {
  sunrise: TerrainEvent | null
  sunset: TerrainEvent | null
  /**
   * Slunce se ten den nad okolní hřebeny vůbec nedostane. V zimě v úzkém údolí
   * to není chyba výpočtu, ale fakt — a je to přesně ta informace, kvůli které
   * se na východ leze jinam.
   */
  blocked: boolean
}

export function terrainSun(
  from: { lat: number; lon: number },
  day: Date,
  horizon: Horizon,
  flat: { sunrise: Date | null; sunset: Date | null },
): TerrainSun {
  const start = new Date(day)
  start.setHours(0, 0, 0, 0)

  let firstAbove: Date | null = null
  let lastAbove: Date | null = null
  let riseBlocker: HorizonPoint | null = null
  let setBlocker: HorizonPoint | null = null

  for (let i = 0; i <= 1440; i++) {
    const at = new Date(start.getTime() + i * 60_000)
    const sun = sunPosition(from.lat, from.lon, at)
    const above = sun.altitude > horizon.angleAt(sun.azimuth)
    if (above && !firstAbove) {
      firstAbove = at
      riseBlocker = nearestPoint(horizon.points, sun.azimuth)
    }
    if (above) {
      lastAbove = at
      setBlocker = nearestPoint(horizon.points, sun.azimuth)
    }
  }

  const minutes = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / 60_000)
  return {
    sunrise:
      firstAbove && flat.sunrise
        ? { at: firstAbove, delayMin: minutes(firstAbove, flat.sunrise), blocker: riseBlocker }
        : null,
    sunset:
      lastAbove && flat.sunset
        ? { at: lastAbove, delayMin: minutes(flat.sunset, lastAbove), blocker: setBlocker }
        : null,
    blocked: firstAbove === null && flat.sunrise !== null,
  }
}

function nearestPoint(points: HorizonPoint[], azimuth: number): HorizonPoint | null {
  if (points.length === 0) return null
  return points.reduce((best, p) => {
    const d = (x: HorizonPoint) => Math.abs(((x.azimuth - azimuth + 540) % 360) - 180)
    return d(p) < d(best) ? p : best
  })
}
