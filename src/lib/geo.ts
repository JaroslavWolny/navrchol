const R_EARTH = 6371

const rad = (d: number) => (d * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI

/** Vzdálenost dvou bodů po povrchu, v kilometrech. */
export function haversine(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R_EARTH * Math.asin(Math.sqrt(h))
}

/**
 * Okruh končí tam, kde začal. Návrat je pak už v bodech trasy — kdyby se k tomu
 * zapnulo i tam a zpět, šla by se celá trasa dvakrát.
 */
export function isLoop(waypoints: Array<{ lat: number; lon: number }>): boolean {
  return waypoints.length > 2 && haversine(waypoints[0], waypoints[waypoints.length - 1]) < 0.15
}

/** Kumulativní vzdálenost podél lomené čáry, v kilometrech. První prvek je nula. */
export function cumulativeKm(points: Array<{ lat: number; lon: number }>): number[] {
  const out = new Array<number>(points.length).fill(0)
  for (let i = 1; i < points.length; i++) out[i] = out[i - 1] + haversine(points[i - 1], points[i])
  return out
}

/**
 * Nastoupané a naklesané metry s hysterezí. Prostý součet kladných rozdílů
 * započítá každý schod šumu v datech — u GPX z hodinek to dělá i stovky metrů
 * navíc. Pět metrů odpovídá tomu, co počítá BRouter („filtered ascend").
 */
export function climb(elevations: number[], hysteresis = 5): { ascent: number; descent: number } {
  if (elevations.length < 2) return { ascent: 0, descent: 0 }
  let ascent = 0
  let descent = 0
  let ref = elevations[0]
  for (let i = 1; i < elevations.length; i++) {
    const d = elevations[i] - ref
    if (d >= hysteresis) {
      ascent += d
      ref = elevations[i]
    } else if (d <= -hysteresis) {
      descent -= d
      ref = elevations[i]
    }
  }
  return { ascent: Math.round(ascent), descent: Math.round(descent) }
}

/**
 * Vyhlazení výšek klouzavým průměrem přes vzdálenost, ne přes počet bodů —
 * záznam z hodinek má body po vteřinách, plán z mapy po desítkách metrů.
 * Bez vyhlazení dělá šum z každého metru cesty strmý úsek a Tobler pak
 * zpomalí rovinku, jako by to byl žebřík.
 */
export function smoothElevations<T extends { lat: number; lon: number; elevation: number }>(
  points: T[],
  halfWindowKm = 0.04,
): T[] {
  if (points.length < 3) return points
  const cum = cumulativeKm(points)
  const out: T[] = []
  let lo = 0
  let hi = 0
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    while (hi < points.length && cum[hi] - cum[i] <= halfWindowKm) sum += points[hi++].elevation
    while (cum[i] - cum[lo] > halfWindowKm) sum -= points[lo++].elevation
    out.push({ ...points[i], elevation: sum / (hi - lo) })
  }
  return out
}

/** Body po úsečce s krokem nejvýš `stepKm`, včetně obou konců. */
export function densify(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
  stepKm: number,
): Array<{ lat: number; lon: number; t: number }> {
  const n = Math.max(1, Math.ceil(haversine(a, b) / stepKm))
  const out: Array<{ lat: number; lon: number; t: number }> = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    out.push({ lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t, t })
  }
  return out
}

/** Deklinace Slunce pro daný den v roce, ve stupních. Přesnost cca ±0,5°. */
export function solarDeclination(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0)
  const dayOfYear = Math.floor((date.getTime() - start) / 86400000)
  return 23.44 * Math.sin((2 * Math.PI * (dayOfYear - 81)) / 365.24)
}

/**
 * Azimut východu a západu Slunce ve stupních od severu.
 * Geometrický horizont — refrakci a převýšení okolních kopců neřeší.
 */
export function sunAzimuths(lat: number, date: Date): { sunrise: number; sunset: number } {
  const dec = rad(solarDeclination(date))
  const cosA = Math.sin(dec) / Math.cos(rad(lat))
  // Za polárním kruhem slunce nevyjde ani nezapadne.
  const clamped = Math.max(-1, Math.min(1, cosA))
  const sunrise = deg(Math.acos(clamped))
  return { sunrise, sunset: 360 - sunrise }
}

const COMPASS = ['S', 'SV', 'V', 'JV', 'J', 'JZ', 'Z', 'SZ']

/** Azimut na českou zkratku světové strany. */
export function compassPoint(azimuth: number): string {
  const i = Math.round(((azimuth % 360) + 360) % 360 / 45) % 8
  return COMPASS[i]
}
