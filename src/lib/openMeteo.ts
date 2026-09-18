import type { DayInfo, HourPoint, ModelSeries, PointForecast, Spread, Waypoint } from './types'

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'

/** Proměnné, které tahám zvlášť za každý model. */
const PER_MODEL = [
  'temperature_2m',
  'apparent_temperature',
  'precipitation',
  'precipitation_probability',
  'wind_speed_10m',
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
] as const

const inBox = (lat: number, lon: number, la1: number, la2: number, lo1: number, lo2: number) =>
  lat >= la1 && lat <= la2 && lon >= lo1 && lon <= lo2

/**
 * Nejjemnější dostupný model pro dané místo plus tři hrubší pro porovnání.
 * Shoda mezi nimi je to, co appka prodává jako spolehlivost.
 */
export function modelsFor(lat: number, lon: number): string[] {
  // Alpský oblouk. ICON-CH1 (1 km) i AROME (1,3 km) sem oba dosáhnou a jejich domény
  // se překrývají, tak se použijí oba — dva nezávislé jemné modely dají nejpoctivější
  // odhad shody, což je v Alpách to, na čem záleží nejvíc.
  if (inBox(lat, lon, 45.6, 48.0, 5.8, 11.0)) {
    return ['meteoswiss_icon_ch1', 'arome_france_hd', 'ecmwf_ifs025', 'gfs_seamless']
  }
  // Francie včetně francouzských Alp a Pyrenejí: AROME 1,3 km.
  if (inBox(lat, lon, 41.0, 51.2, -5.5, 8.3)) {
    return ['arome_france_hd', 'icon_eu', 'ecmwf_ifs025', 'gfs_seamless']
  }
  // Doména ICON-D2 (2,2 km): Česko, Německo, Rakousko, Polsko, sever Itálie.
  if (inBox(lat, lon, 43.2, 58.0, -3.9, 20.3)) {
    return ['icon_d2', 'icon_eu', 'ecmwf_ifs025', 'gfs_seamless']
  }
  return ['icon_seamless', 'ecmwf_ifs025', 'gfs_seamless', 'gem_seamless']
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

function range(values: number[]): number {
  return values.length < 2 ? 0 : Math.max(...values) - Math.min(...values)
}

/** Rozptyl přepočtený na jedno číslo shody. Prahy jsou empirické, ne posvátné. */
function agreementOf(tempRange: number, gustRange: number, precipRange: number): number {
  const disagreement =
    (clamp(tempRange / 6, 0, 1) + clamp(gustRange / 40, 0, 1) + clamp(precipRange / 8, 0, 1)) / 3
  return Math.round(100 * (1 - disagreement))
}

interface RawLocation {
  latitude: number
  longitude: number
  elevation: number
  hourly: Record<string, Array<number | null>>
  daily?: Record<string, Array<string | number | null>>
}

const asArray = (data: unknown): RawLocation[] =>
  Array.isArray(data) ? (data as RawLocation[]) : [data as RawLocation]

function buildUrl(params: Record<string, string>): string {
  const q = new URLSearchParams(params)
  return `${FORECAST_URL}?${q.toString()}`
}

export interface Forecast {
  points: PointForecast[]
  days: DayInfo[]
  /** Kdy se data stáhla — na mobilu se běžně kouká na hodinu staré. */
  fetchedAt: Date
}

/**
 * Jeden request na všechny body trasy a všechny modely naráz, druhý na UV a časy slunce.
 * Open-Meteo umí dávku souřadnic, takže čtyři waypointy nestojí čtyři kola po síti.
 */
export async function fetchForecast(
  waypoints: Waypoint[],
  days = 7,
  signal?: AbortSignal,
): Promise<Forecast> {
  if (waypoints.length === 0) throw new Error('Trasa nemá žádné body.')

  const models = modelsFor(waypoints[0].lat, waypoints[0].lon)
  const common = {
    latitude: waypoints.map((w) => w.lat).join(','),
    longitude: waypoints.map((w) => w.lon).join(','),
    elevation: waypoints.map((w) => Math.round(w.elevation)).join(','),
    forecast_days: String(days),
    timezone: 'auto',
  }

  const mainUrl = buildUrl({ ...common, hourly: PER_MODEL.join(','), models: models.join(',') })
  // UV index ani časy slunce se přes `models` nevrací — jsou jen v základní sadě.
  const auxUrl = buildUrl({ ...common, hourly: 'uv_index', daily: 'sunrise,sunset' })

  const [mainRes, auxRes] = await Promise.all([
    fetch(mainUrl, { signal }),
    fetch(auxUrl, { signal }),
  ])
  if (!mainRes.ok) throw new Error(`Předpověď se nestáhla (${mainRes.status}).`)
  if (!auxRes.ok) throw new Error(`Data o slunci se nestáhla (${auxRes.status}).`)

  const main = asArray(await mainRes.json())
  const aux = asArray(await auxRes.json())

  const points = waypoints.map((w, i) => mergeModels(w, main[i], aux[i], models))
  const days0 = aux[0]?.daily
  const dayInfo: DayInfo[] = (days0?.time ?? []).map((date, i) => ({
    date: String(date),
    sunrise: String(days0?.sunrise?.[i] ?? ''),
    sunset: String(days0?.sunset?.[i] ?? ''),
  }))

  return { points, days: dayInfo, fetchedAt: new Date() }
}

/** Z N modelů udělá jednu řadu mediánů plus rozptyl, který se ukáže jako shoda. */
function mergeModels(
  waypoint: Waypoint,
  raw: RawLocation | undefined,
  auxRaw: RawLocation | undefined,
  models: string[],
): PointForecast {
  const times = (raw?.hourly?.time as unknown as string[]) ?? []
  const uv = auxRaw?.hourly?.uv_index ?? []

  const valuesAt = (base: string, i: number): number[] =>
    models
      .map((m) => raw?.hourly?.[`${base}_${m}`]?.[i])
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))

  const present = models.filter((m) =>
    (raw?.hourly?.[`temperature_2m_${m}`] ?? []).some((v) => typeof v === 'number'),
  )

  const hours: HourPoint[] = []
  const spread: Spread[] = []

  for (let i = 0; i < times.length; i++) {
    const temps = valuesAt('temperature_2m', i)
    const gusts = valuesAt('wind_gusts_10m', i)
    const precip = valuesAt('precipitation', i)

    const num = (base: string, fallback = 0): number => median(valuesAt(base, i)) ?? fallback
    const maybe = (base: string): number | null => median(valuesAt(base, i))

    hours.push({
      time: times[i],
      temperature: num('temperature_2m'),
      apparentTemperature: median(valuesAt('apparent_temperature', i)) ?? num('temperature_2m'),
      precipitation: num('precipitation'),
      precipitationProbability: num('precipitation_probability'),
      windSpeed: num('wind_speed_10m'),
      windGusts: num('wind_gusts_10m'),
      cape: num('cape'),
      cloudCover: num('cloud_cover'),
      cloudLow: num('cloud_cover_low'),
      cloudMid: num('cloud_cover_mid'),
      cloudHigh: num('cloud_cover_high'),
      visibility: maybe('visibility'),
      freezingLevel: maybe('freezing_level_height'),
      snowDepth: num('snow_depth'),
      humidity: num('relative_humidity_2m', 60),
      uvIndex: typeof uv[i] === 'number' ? (uv[i] as number) : 0,
    })

    const tRange = range(temps)
    const gRange = range(gusts)
    const pRange = range(precip)
    spread.push({
      temperature: tRange,
      windGusts: gRange,
      precipitation: pRange,
      agreement: agreementOf(tRange, gRange, pRange),
    })
  }

  const byModel: Record<string, ModelSeries> = {}
  for (const m of present) {
    byModel[m] = {
      temperature: raw?.hourly?.[`temperature_2m_${m}`] ?? [],
      windGusts: raw?.hourly?.[`wind_gusts_10m_${m}`] ?? [],
      precipitation: raw?.hourly?.[`precipitation_${m}`] ?? [],
    }
  }

  return { waypointId: waypoint.id, hours, spread, models: present, byModel }
}

export interface ModelDeviation {
  model: string
  /** 0 = sedí s ostatními, 1 = úplně mimo. */
  deviation: number
}

/**
 * Jak daleko je každý model od mediánu ostatních v dané hodině.
 * Tohle je to, co uživatel uvidí jako proužky pod „shodou modelů“ — a co mu
 * dovolí říct „ECMWF si vymýšlí“ místo slepé důvěry v jedno číslo.
 */
export function modelDeviations(point: PointForecast, hourIdx: number): ModelDeviation[] {
  const hour = point.hours[hourIdx]
  if (!hour) return []

  return point.models.map((model) => {
    const s = point.byModel[model]
    const t = s?.temperature?.[hourIdx]
    const g = s?.windGusts?.[hourIdx]
    const p = s?.precipitation?.[hourIdx]

    const parts: number[] = []
    if (typeof t === 'number') parts.push(clamp(Math.abs(t - hour.temperature) / 4, 0, 1))
    if (typeof g === 'number') parts.push(clamp(Math.abs(g - hour.windGusts) / 25, 0, 1))
    if (typeof p === 'number') parts.push(clamp(Math.abs(p - hour.precipitation) / 5, 0, 1))

    const deviation = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 0
    return { model, deviation }
  })
}

/** Krátký, čitelný název modelu. */
export function modelLabel(model: string): string {
  const map: Record<string, string> = {
    icon_d2: 'ICON-D2',
    icon_eu: 'ICON-EU',
    icon_seamless: 'ICON',
    ecmwf_ifs025: 'ECMWF',
    gfs_seamless: 'GFS',
    gem_seamless: 'GEM',
    meteoswiss_icon_ch1: 'ICON-CH1',
    arome_france_hd: 'AROME',
  }
  return map[model] ?? model.toUpperCase()
}
