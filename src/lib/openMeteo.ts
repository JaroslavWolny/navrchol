import { EXPOSED_ABOVE_M, RIDGE_GUST_FACTOR } from './constants'
import type { DayInfo, ForecastSite, HourPoint, PointForecast, Spread } from './types'

export { SNOW_CM_PER_MM } from './constants'

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'
const ENSEMBLE_URL = 'https://ensemble-api.open-meteo.com/v1/ensemble'
const AIR_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality'

/**
 * Tvar počasí. Nejjemnější model, který na dané místo dosáhne, vybírá Open-Meteo samo
 * (`best_match`) — v Krkonoších ICON-D2 na 2,2 km, v Alpách ICON-CH1, jinde globál.
 */
const SHAPE = [
  'temperature_2m',
  'apparent_temperature',
  'precipitation',
  'snowfall',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
  'cape',
  'cloud_cover',
  'cloud_cover_low',
  'cloud_cover_mid',
  'cloud_cover_high',
  'visibility',
  'freezing_level_height',
  'snow_depth',
  'relative_humidity_2m',
  'uv_index',
] as const

/**
 * Tlakové hladiny pro teplotní profil. Bez něj se inverze nepozná: přízemní
 * teplota sama o sobě neřekne, jestli je nad údolím teplejší vzduch, který
 * drží mlhu dole.
 */
const LEVELS_HPA = [1000, 975, 950, 925, 900, 850, 800] as const
const LEVEL_VARS = LEVELS_HPA.flatMap((hpa) => [`temperature_${hpa}hPa`, `geopotential_height_${hpa}hPa`])

/**
 * Vítr ve volné atmosféře. Modelová desetimetrová hladina leží nad vyhlazeným
 * terénem, ne na hřebeni — na Sněžce proto ukazuje v průměru 4,4 m/s, když
 * observatoř měří 10,2 m/s. Vítr v tlakové hladině ve výšce vrcholu tu chybu
 * srazí na polovinu (ověřeno na leden—srpen 2026 proti IMGW).
 */
const WIND_HPA = [900, 850, 800, 700, 600] as const
const WIND_VARS = [
  ...WIND_HPA.map((hpa) => `wind_speed_${hpa}hPa`),
  'geopotential_height_700hPa',
  'geopotential_height_600hPa',
]

/**
 * Veličiny, na kterých stojí rozhodnutí, se berou z pravého ansámblu — desítek členů
 * jednoho modelu, ne pár různě jemných modelů vedle sebe.
 */
const ENSEMBLE_VARS = ['apparent_temperature', 'precipitation', 'snowfall', 'wind_gusts_10m', 'cape'] as const

/** Dva dny dozadu: kolik napadlo před túrou rozhoduje o bahně, mokrých kamenech a brodech. */
const PAST_DAYS = 2

/** Nad tímhle úhrnem za hodinu se členovi ansámblu počítá, že „prší". */
const WET_MM = 0.2

const inBox = (lat: number, lon: number, la1: number, la2: number, lo1: number, lo2: number) =>
  lat >= la1 && lat <= la2 && lon >= lo1 && lon <= lo2

/**
 * Členské ansámbly podle polohy. Jemný ansámbl sahá jen na pár dní, proto se mísí
 * s hrubšími a každý člen váží stejně: ICON-D2-EPS (20 členů, 2 dny) doplní
 * ICON-EU-EPS (40 členů, 5 dní) a ECMWF (51 členů, 7 dní).
 */
export function ensembleModelsFor(lat: number, lon: number): string[] {
  // Doména ICON-D2: Česko, Německo, Rakousko, Polsko, Alpy, sever Itálie.
  if (inBox(lat, lon, 43.2, 58.0, -3.9, 20.3)) {
    return ['icon_d2_eps', 'icon_eu_eps', 'ecmwf_ifs025']
  }
  // Zbytek Evropy a Turecko na doménu ICON-EU dosáhnou.
  if (inBox(lat, lon, 29.5, 70.5, -25.0, 45.0)) {
    return ['icon_eu_eps', 'ecmwf_ifs025', 'gfs025']
  }
  return ['ecmwf_ifs025', 'gfs025', 'gem_global']
}

/** Kvantil z členů ansámblu. Pole musí být setřídené. */
function quantile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const i = (sorted.length - 1) * p
  const lo = Math.floor(i)
  const hi = Math.min(lo + 1, sorted.length - 1)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo)
}

export interface RawLocation {
  latitude: number
  longitude: number
  elevation: number
  hourly: Record<string, Array<number | null>>
  daily?: Record<string, Array<string | number | null>>
}

const asArray = (data: unknown): RawLocation[] =>
  Array.isArray(data) ? (data as RawLocation[]) : [data as RawLocation]

function buildUrl(base: string, params: Record<string, string>): string {
  return `${base}?${new URLSearchParams(params).toString()}`
}

export interface Forecast {
  /** Místa podél trati, pro která se předpověď stahovala. */
  sites: ForecastSite[]
  points: PointForecast[]
  days: DayInfo[]
  /** Kdy se data stáhla (ms). Na mobilu se běžně kouká na hodinu staré. */
  fetchedAt: number
  /** Které ansámbly dorazily. Prázdné = ansámbl se nestáhl a skóruje se bez rezervy. */
  ensembles: string[]
}

class RateLimited extends Error {}

async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const res = await fetch(url, { signal })
  if (res.status === 429) throw new RateLimited('Open-Meteo hlásí limit dotazů (429).')
  if (!res.ok) throw new Error(`Předpověď se nestáhla (${res.status}).`)
  return res.json()
}

/**
 * Čtyři dotazy na celou trasu: tvar počasí ve všech místech podél trati, vítr
 * a teploty ve volné atmosféře jen tam, kde se použijí (hřeben a vrchol),
 * rizikové veličiny z ansámblu a zákal. Ansámbl se stahuje jen v nejnižším
 * a nejvyšším místě — je to velká odpověď s minutovým limitem, a mezi dvěma
 * výškami se dá rozumně dopočítat. Když nedorazí, appka jede dál jen
 * s jemným modelem.
 */
export async function fetchForecast(
  sites: ForecastSite[],
  days = 7,
  signal?: AbortSignal,
): Promise<Forecast> {
  if (sites.length === 0) throw new Error('Trasa nemá žádné body.')

  const coords = (list: ForecastSite[]) => ({
    latitude: list.map((s) => s.lat).join(','),
    longitude: list.map((s) => s.lon).join(','),
    elevation: list.map((s) => Math.round(s.elevation)).join(','),
    forecast_days: String(days),
    timezone: 'auto',
  })

  const byElevation = [...sites].sort((a, b) => a.elevation - b.elevation)
  const ensembleSites =
    byElevation.length > 1 ? [byElevation[0], byElevation[byElevation.length - 1]] : [byElevation[0]]
  const top = byElevation[byElevation.length - 1]
  const models = ensembleModelsFor(sites[0].lat, sites[0].lon)

  const shapeUrl = buildUrl(FORECAST_URL, {
    ...coords(sites),
    past_days: String(PAST_DAYS),
    hourly: SHAPE.join(','),
    daily: 'sunrise,sunset',
  })
  // Tlakové hladiny stojí dvacet proměnných na místo. Potřeba jsou jen na hřebeni
  // (vítr) a na vrcholu (inverze pro moře mlhy), tak se jinde nestahují.
  const upperSites = sites.filter((s) => s.elevation >= EXPOSED_ABOVE_M || s.id === top.id)
  const upperUrl = buildUrl(FORECAST_URL, {
    ...coords(upperSites),
    past_days: String(PAST_DAYS),
    hourly: [...LEVEL_VARS, ...WIND_VARS].join(','),
  })
  const ensembleUrl = buildUrl(ENSEMBLE_URL, {
    ...coords(ensembleSites),
    hourly: ENSEMBLE_VARS.join(','),
    models: models.join(','),
  })
  const airUrl = buildUrl(AIR_URL, { ...coords([top]), hourly: 'aerosol_optical_depth' })

  const [shapeRaw, upperRaw, ensembleRaw, airRaw] = await Promise.all([
    getJson(shapeUrl, signal),
    // Bez volné atmosféry zůstane vítr z modelu a moře mlhy se nespočítá.
    getJson(upperUrl, signal).catch(() => null),
    // Ansámbl je velký a bez klíče se mu dá vyčerpat kvóta. Jeho selhání nesmí
    // shodit celou předpověď — jen se pak skóruje z jemného modelu bez rezervy.
    getJson(ensembleUrl, signal).catch(() => null),
    // Zákal je třešnička pro fotky, ne podklad pro rozhodnutí.
    getJson(airUrl, signal).catch(() => null),
  ])

  const shape = asArray(shapeRaw)
  const upper = upperRaw === null ? [] : asArray(upperRaw)
  const upperOf = new Map(upperSites.map((s, i) => [s.id, upper[i]]))
  const ensemble = ensembleRaw === null ? [] : asArray(ensembleRaw).map(ensembleStats)
  const air = airRaw === null ? null : asArray(airRaw)[0]

  const points = sites.map((site, i) => {
    const ens = ensembleFor(site.elevation, ensembleSites, ensemble)
    return mergePoint(site, shape[i], upperOf.get(site.id), ens, site.id === top.id ? air : null)
  })

  const daily = shape[0]?.daily
  const todayKey = dateKey(new Date())
  const dayInfo: DayInfo[] = (daily?.time ?? [])
    .map((date, i) => ({
      date: String(date),
      sunrise: String(daily?.sunrise?.[i] ?? ''),
      sunset: String(daily?.sunset?.[i] ?? ''),
    }))
    // `past_days` přitáhne i dny dozadu. V hodinových řadách je chceme (kvůli tomu,
    // co napadlo před túrou), v seznamu dnů by z nich byly prázdné řádky.
    .filter((d) => d.date >= todayKey)

  return {
    sites,
    points,
    days: dayInfo,
    fetchedAt: Date.now(),
    ensembles: ensemble.length > 0 ? models : [],
  }
}

export const isRateLimited = (e: unknown) => e instanceof RateLimited

const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Co z ansámblu potřebujeme v jedné hodině. */
interface EnsembleHour {
  apparentP25: number
  precipP75: number
  wetShare: number
  snowP75: number
  gustP75: number
  gustP90: number
  capeP75: number
  spreadTemperature: number
  spreadGusts: number
  spreadPrecip: number
  members: number
}

type EnsembleSeries = Map<string, EnsembleHour>

/** Setřídí členy po hodinách a spočítá kvantily, které appka potřebuje. */
function ensembleStats(raw: RawLocation): EnsembleSeries {
  const times = (raw.hourly?.time as unknown as string[]) ?? []
  const keysOf = (v: string) => Object.keys(raw.hourly ?? {}).filter((k) => k.startsWith(`${v}_`) || k === v)
  const keys = Object.fromEntries(ENSEMBLE_VARS.map((v) => [v, keysOf(v)])) as Record<
    (typeof ENSEMBLE_VARS)[number],
    string[]
  >

  const out: EnsembleSeries = new Map()
  times.forEach((time, i) => {
    const members = (v: (typeof ENSEMBLE_VARS)[number]) => {
      const vals: number[] = []
      for (const k of keys[v]) {
        const x = raw.hourly[k]?.[i]
        if (typeof x === 'number' && Number.isFinite(x)) vals.push(x)
      }
      return vals.sort((a, b) => a - b)
    }
    const apparent = members('apparent_temperature')
    const precip = members('precipitation')
    const gusts = members('wind_gusts_10m')
    if (precip.length === 0) return
    const width = (vals: number[]) => (vals.length < 2 ? 0 : quantile(vals, 0.9) - quantile(vals, 0.1))
    out.set(time, {
      apparentP25: quantile(apparent, 0.25),
      precipP75: quantile(precip, 0.75),
      wetShare: precip.filter((v) => v > WET_MM).length / precip.length,
      snowP75: quantile(members('snowfall'), 0.75),
      gustP75: quantile(gusts, 0.75),
      gustP90: quantile(gusts, 0.9),
      capeP75: quantile(members('cape'), 0.75),
      spreadTemperature: width(apparent),
      spreadGusts: width(gusts),
      spreadPrecip: width(precip),
      members: precip.length,
    })
  })
  return out
}

/**
 * Ansámbl pro místo v libovolné výšce: lineárně mezi nejnižším a nejvyšším
 * místem, kde se stahoval. Teplota s výškou klesá skoro lineárně, nárazy
 * a srážky s ní rostou — pro místa po cestě je to lepší odhad než vzít
 * údolí, nebo vrchol.
 */
function ensembleFor(
  elevation: number,
  ensembleSites: ForecastSite[],
  series: EnsembleSeries[],
): (time: string) => EnsembleHour | null {
  if (series.length === 0) return () => null
  if (series.length === 1 || ensembleSites.length === 1) return (t) => series[0].get(t) ?? null
  const [low, high] = ensembleSites
  const span = high.elevation - low.elevation
  const w = span > 0 ? Math.max(0, Math.min(1, (elevation - low.elevation) / span)) : 1
  return (time) => {
    const a = series[0].get(time)
    const b = series[1]?.get(time)
    if (!a || !b) return a ?? b ?? null
    const mix = (x: number, y: number) => x + (y - x) * w
    return {
      apparentP25: mix(a.apparentP25, b.apparentP25),
      precipP75: mix(a.precipP75, b.precipP75),
      wetShare: mix(a.wetShare, b.wetShare),
      snowP75: mix(a.snowP75, b.snowP75),
      gustP75: mix(a.gustP75, b.gustP75),
      gustP90: mix(a.gustP90, b.gustP90),
      capeP75: mix(a.capeP75, b.capeP75),
      spreadTemperature: mix(a.spreadTemperature, b.spreadTemperature),
      spreadGusts: mix(a.spreadGusts, b.spreadGusts),
      spreadPrecip: mix(a.spreadPrecip, b.spreadPrecip),
      members: Math.min(a.members, b.members),
    }
  }
}

/**
 * Vítr ve volné atmosféře ve výšce místa, lineárně mezi tlakovými hladinami.
 * Pod nejnižší hladinou se nic nedopočítává — tam je místo v terénu, kde
 * volná atmosféra nic neříká. Null = místo leží pod ní nebo data chybí.
 */
export function freeWindAt(raw: RawLocation | undefined, i: number, elevation: number): number | null {
  const levels: Array<{ height: number; speed: number }> = []
  for (const hpa of WIND_HPA) {
    const speed = raw?.hourly?.[`wind_speed_${hpa}hPa`]?.[i]
    const height = raw?.hourly?.[`geopotential_height_${hpa}hPa`]?.[i]
    if (typeof speed === 'number' && typeof height === 'number') levels.push({ height, speed })
  }
  if (levels.length === 0) return null
  levels.sort((a, b) => a.height - b.height)
  if (elevation < levels[0].height) return null
  const last = levels[levels.length - 1]
  if (elevation >= last.height) return last.speed
  for (let k = 1; k < levels.length; k++) {
    const a = levels[k - 1]
    const b = levels[k]
    if (elevation <= b.height) return a.speed + ((b.speed - a.speed) * (elevation - a.height)) / (b.height - a.height)
  }
  return last.speed
}

/**
 * Z jemného modelu a z ansámblu udělá jednu řadu hodin: ukazované hodnoty z modelu,
 * rizikové kvantily z ansámblu. Riziková hodnota je vždycky ta horší z obou.
 */
function mergePoint(
  site: ForecastSite,
  raw: RawLocation | undefined,
  upperRaw: RawLocation | undefined,
  ensemble: (time: string) => EnsembleHour | null,
  airRaw: RawLocation | null,
): PointForecast {
  const times = (raw?.hourly?.time as unknown as string[]) ?? []
  const upperTimes = (upperRaw?.hourly?.time as unknown as string[]) ?? []
  const upperIndex = new Map(upperTimes.map((t, i) => [t, i]))
  const airTimes = (airRaw?.hourly?.time as unknown as string[]) ?? []
  const airIndex = new Map(airTimes.map((t, i) => [t, i]))
  const exposed = site.elevation >= EXPOSED_ABOVE_M

  const at = (base: string, i: number, fallback = 0): number => {
    const v = raw?.hourly?.[base]?.[i]
    return typeof v === 'number' && Number.isFinite(v) ? v : fallback
  }
  const maybeAt = (base: string, i: number): number | null => {
    const v = raw?.hourly?.[base]?.[i]
    return typeof v === 'number' && Number.isFinite(v) ? v : null
  }

  const hours: HourPoint[] = []
  const spread: Spread[] = []

  for (let i = 0; i < times.length; i++) {
    const e = ensemble(times[i])
    const u = upperIndex.get(times[i])

    const apparent = at('apparent_temperature', i, at('temperature_2m', i))
    const precip = at('precipitation', i)
    const snow = at('snowfall', i)
    const cape = at('cape', i)

    // Na exponovaném místě se vítr dorovná na vítr volné atmosféry ve stejné výšce.
    let wind = at('wind_speed_10m', i)
    let gusts = at('wind_gusts_10m', i)
    let ridgeWind = false
    if (exposed) {
      const free = u === undefined ? null : freeWindAt(upperRaw, u, site.elevation)
      if (free !== null && (free > wind || free * RIDGE_GUST_FACTOR > gusts)) {
        ridgeWind = true
        wind = Math.max(wind, free)
        gusts = Math.max(gusts, free * RIDGE_GUST_FACTOR)
      }
    }

    hours.push({
      time: times[i],
      temperature: at('temperature_2m', i),
      apparentTemperature: apparent,
      apparentTemperatureRisk: e ? Math.min(apparent, e.apparentP25) : apparent,
      precipitation: precip,
      precipitationRisk: e ? Math.max(precip, e.precipP75) : precip,
      precipitationProbability: e ? 100 * e.wetShare : precip > WET_MM ? 100 : 0,
      snowfall: snow,
      snowfallRisk: e ? Math.max(snow, e.snowP75) : snow,
      windSpeed: wind,
      windDirection: at('wind_direction_10m', i),
      windGusts: gusts,
      windGustsRisk: e ? Math.max(gusts, e.gustP75) : gusts,
      windGustsHigh: e ? Math.max(gusts, e.gustP90) : gusts,
      ridgeWind,
      cape,
      capeRisk: e ? Math.max(cape, e.capeP75) : cape,
      cloudCover: at('cloud_cover', i),
      cloudLow: at('cloud_cover_low', i),
      cloudMid: at('cloud_cover_mid', i),
      cloudHigh: at('cloud_cover_high', i),
      visibility: maybeAt('visibility', i),
      freezingLevel: maybeAt('freezing_level_height', i),
      snowDepth: at('snow_depth', i),
      humidity: at('relative_humidity_2m', i, 60),
      uvIndex: at('uv_index', i),
      levels: u === undefined ? [] : levelsAt(upperRaw, u),
      aerosol: aerosolAt(airRaw, airIndex.get(times[i])),
      members: e?.members ?? 0,
    })

    spread.push({
      temperature: e?.spreadTemperature ?? 0,
      windGusts: e?.spreadGusts ?? 0,
      precipitation: e?.spreadPrecip ?? 0,
      members: e?.members ?? 0,
    })
  }

  return { siteId: site.id, hours, spread }
}

/** Teplotní profil v dané hodině, setříděný od země nahoru. */
function levelsAt(raw: RawLocation | undefined, i: number): HourPoint['levels'] {
  const out: HourPoint['levels'] = []
  for (const hpa of LEVELS_HPA) {
    const temperature = raw?.hourly?.[`temperature_${hpa}hPa`]?.[i]
    const height = raw?.hourly?.[`geopotential_height_${hpa}hPa`]?.[i]
    if (typeof temperature === 'number' && typeof height === 'number') {
      out.push({ height: Math.round(height), temperature: Math.round(temperature * 10) / 10 })
    }
  }
  return out.sort((a, b) => a.height - b.height)
}

function aerosolAt(raw: RawLocation | null, index: number | undefined): number | null {
  if (raw === null || index === undefined) return null
  const v = raw.hourly?.aerosol_optical_depth?.[index]
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/** Krátký, čitelný název ansámblu. */
export function modelLabel(model: string): string {
  const map: Record<string, string> = {
    icon_d2_eps: 'ICON-D2-EPS',
    icon_eu_eps: 'ICON-EU-EPS',
    ecmwf_ifs025: 'ECMWF-ENS',
    gfs025: 'GEFS',
    gem_global: 'GEM',
  }
  return map[model] ?? model.toUpperCase()
}
