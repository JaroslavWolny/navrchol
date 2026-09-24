import { cumulativeKm } from './geo'
import type { ForecastSite, TrackPoint } from './types'

/** Víc míst nemá cenu: dávka pro Open-Meteo se s každým místem prodražuje. */
export const MAX_SITES = 8

/**
 * Kde podél trati stáhnout předpověď.
 *
 * Předpověď v bodech, které si člověk naklikal, nestačí: u trasy „parkoviště →
 * vrchol" by hřeben mezi nimi neměl vlastní počasí vůbec. Tady se proto
 * vybírají místa podle toho, na čem počasí na horách opravdu záleží —
 * nejvyšší bod, nejnižší bod, výrazné vrcholy po cestě a pak rovnoměrně
 * po délce. Dvě místa blízko u sebe a ve stejné výšce by stála dvakrát
 * a řekla totéž, takže z nich zůstane jedno.
 */
export function forecastSites(points: TrackPoint[], max = MAX_SITES): ForecastSite[] {
  const n = points.length
  if (n === 0) return []
  const cum = cumulativeKm(points)
  const total = cum[n - 1]

  const elevation = (i: number) => points[i].elevation
  const argBy = (better: (a: number, b: number) => boolean) =>
    points.reduce((best, _, i) => (better(elevation(i), elevation(best)) ? i : best), 0)
  const highest = argBy((a, b) => a > b)
  const lowest = argBy((a, b) => a < b)

  // Výrazné vrcholy po cestě: nejvyšší bod v okně ±1,5 km, který nad okolím
  // vyčnívá aspoň o 60 m. Sedlo mezi nimi je vidět jako nejnižší bod okna.
  const peaks: number[] = []
  let lo = 0
  let hi = 0
  for (let i = 0; i < n; i++) {
    while (cum[i] - cum[lo] > 1.5) lo++
    while (hi < n - 1 && cum[hi + 1] - cum[i] <= 1.5) hi++
    let isMax = true
    let minAround = elevation(i)
    for (let j = lo; j <= hi; j++) {
      if (elevation(j) > elevation(i)) {
        isMax = false
        break
      }
      minAround = Math.min(minAround, elevation(j))
    }
    if (isMax && elevation(i) - minAround >= 60) peaks.push(i)
  }
  peaks.sort((a, b) => elevation(b) - elevation(a))

  // Rovnoměrně po délce, aby dlouhá plochá pasáž taky dostala vlastní předpověď.
  const even: number[] = []
  const slots = Math.min(max, Math.max(2, Math.round(total / 2)))
  for (let k = 1; k < slots; k++) {
    const target = (total * k) / slots
    let i = 0
    while (i < n - 1 && cum[i] < target) i++
    even.push(i)
  }

  const candidates = [highest, 0, n - 1, lowest, ...peaks, ...even]
  // Blízko po trati a zároveň ve stejné výšce = stejné počasí.
  const spacing = Math.max(0.8, total / (max * 1.5))
  const accepted: number[] = []
  for (const i of candidates) {
    if (accepted.length >= max) break
    const duplicate = accepted.some(
      (j) => Math.abs(cum[i] - cum[j]) < spacing && Math.abs(elevation(i) - elevation(j)) < 120,
    )
    if (!duplicate) accepted.push(i)
  }

  return accepted
    .sort((a, b) => a - b)
    .map((i, k) => ({
      id: `s${k}`,
      lat: Math.round(points[i].lat * 1e5) / 1e5,
      lon: Math.round(points[i].lon * 1e5) / 1e5,
      elevation: Math.round(elevation(i)),
      trackIndex: i,
    }))
}

/**
 * Pro každý bod (i zrcadlené) trati to místo předpovědi, které je k němu
 * po trati nejblíž. U túry tam a zpět se bod za obrátkou překlopí zpátky
 * na jednosměrnou trať — cesta dolů jde stejnými místy jako cesta nahoru.
 */
export function siteIndexByPoint(
  points: TrackPoint[],
  sites: ForecastSite[],
  turnIndex?: number,
): Int16Array {
  const out = new Int16Array(points.length)
  if (sites.length === 0) return out.fill(-1)
  const oneWay = turnIndex === undefined ? points : points.slice(0, turnIndex + 1)
  const cum = cumulativeKm(oneWay)
  const siteKm = sites.map((s) => cum[Math.min(s.trackIndex, cum.length - 1)] ?? 0)

  for (let i = 0; i < points.length; i++) {
    const j = turnIndex !== undefined && i > turnIndex ? 2 * turnIndex - i : i
    const km = cum[Math.max(0, Math.min(j, cum.length - 1))]
    let best = 0
    for (let k = 1; k < sites.length; k++) {
      if (Math.abs(siteKm[k] - km) < Math.abs(siteKm[best] - km)) best = k
    }
    out[i] = best
  }
  return out
}
