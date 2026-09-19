import type { DayInfo, HourPoint, PointForecast, Spread, Waypoint } from './types'

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'
const ENSEMBLE_URL = 'https://ensemble-api.open-meteo.com/v1/ensemble'
const AIR_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality'

/**
 * Tvar počasí. Nejjemnější model, který na dané místo dosáhne, vybírá Open-Meteo samo
 * (`best_match`) — v Krkonoších ICON-D2 na 2,2 km, v Alpách ICON-CH1, jinde globál.
 * Tohle jsou hodnoty, které se ukazují: jeden ostrý scénář z modelu, který vrchol vidí.
 */
const SHAPE = [
  'temperature_2m',
  'apparent_temperature',
  'precipitation',
  'rain',
  'snowfall',
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
  'uv_index',
] as const

/**
 * Tlakové hladiny pro teplotní profil. Bez něj se inverze nepozná: přízemní
 * teplota sama o sobě neřekne, jestli je nad údolím teplejší vzduch, který
 * drží mlhu dole.
 */
const LEVELS_HPA = [1000, 975, 950, 925, 900, 850, 800] as const
const LEVEL_VARS = LEVELS_HPA.flatMap((hpa) => [
  `temperature_${hpa}hPa`,
  `geopotential_height_${hpa}hPa`,
])

/**
 * Veličiny, na kterých stojí rozhodnutí, se berou z pravého ansámblu — desítky členů
 * jednoho modelu, ne pár různě jemných modelů vedle sebe. Porovnávat ICON-D2 (2,2 km)
 * s ECMWF (11 km) měří rozlišení, ne nejistotu: ICON-D2 dává na Sněžce nárazy
 * 40—106 km/h, ECMWF 6—63, a z toho rozdílu žádná „shoda modelů" nevyjde.
 */
const ENSEMBLE_VARS = ['apparent_temperature', 'precipitation', 'snowfall', 'wind_gusts_10m', 'cape'] as const

/** Dva dny dozadu: kolik napadlo před túrou rozhoduje o bahně, mokrých kamenech a brodech. */
const PAST_DAYS = 2

/** Nad tímhle úhrnem za hodinu se členovi ansámblu počítá, že „prší". */
const WET_MM = 0.2

/** Sníh se hlásí v centimetrech, srážky v milimetrech vody. Open-Meteo drží poměr 1 : 0,7. */
export const SNOW_CM_PER_MM = 0.7

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

interface RawLocation {
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
  points: PointForecast[]
  days: DayInfo[]
  /** Kdy se data stáhla — na mobilu se běžně kouká na hodinu staré. */
  fetchedAt: Date
  /** Které ansámbly dorazily. Prázdné = ansámbl se nestáhl a skóruje se bez rezervy. */
  ensembles: string[]
}

/**
 * Dva requesty na celou trasu: tvar počasí z nejjemnějšího modelu a rizikové veličiny
 * z ansámblu. Open-Meteo umí dávku souřadnic, takže čtyři waypointy nestojí čtyři kola
 * po síti. Když ansámbl nedorazí, appka jede dál jen s jemným modelem.
 */
export async function fetchForecast(
  waypoints: Waypoint[],
  days = 7,
  signal?: AbortSignal,
): Promise<Forecast> {
  if (waypoints.length === 0) throw new Error('Trasa nemá žádné body.')

  const common = {
    latitude: waypoints.map((w) => w.lat).join(','),
    longitude: waypoints.map((w) => w.lon).join(','),
    elevation: waypoints.map((w) => Math.round(w.elevation)).join(','),
    forecast_days: String(days),
    timezone: 'auto',
  }
  const models = ensembleModelsFor(waypoints[0].lat, waypoints[0].lon)

  const shapeUrl = buildUrl(FORECAST_URL, {
    ...common,
    past_days: String(PAST_DAYS),
    hourly: [...SHAPE, ...LEVEL_VARS].join(','),
    daily: 'sunrise,sunset',
  })
  const airUrl = buildUrl(AIR_URL, { ...common, hourly: 'aerosol_optical_depth' })
  const ensembleUrl = buildUrl(ENSEMBLE_URL, {
    ...common,
    hourly: ENSEMBLE_VARS.join(','),
    models: models.join(','),
  })

  const [shapeRes, ensembleRaw, airRaw] = await Promise.all([
    fetch(shapeUrl, { signal }),
    // Ansámbl je velký a bez klíče se mu dá vyčerpat kvóta. Jeho selhání nesmí
    // shodit celou předpověď — jen se pak skóruje z jemného modelu bez rezervy.
    fetch(ensembleUrl, { signal })
      .then((r) => (r.ok ? (r.json() as Promise<unknown>) : null))
      .catch(() => null),
    // Zákal je třešnička pro fotky, ne podklad pro rozhodnutí — když nedorazí,
    // appka o něm mlčí a jede dál.
    fetch(airUrl, { signal })
      .then((r) => (r.ok ? (r.json() as Promise<unknown>) : null))
      .catch(() => null),
  ])
  if (!shapeRes.ok) throw new Error(`Předpověď se nestáhla (${shapeRes.status}).`)

  const shape = asArray(await shapeRes.json())
  const ensemble = ensembleRaw === null ? [] : asArray(ensembleRaw)
  const air = airRaw === null ? [] : asArray(airRaw)

  const points = waypoints.map((w, i) => mergePoint(w, shape[i], ensemble[i], air[i]))
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
    points,
    days: dayInfo,
    fetchedAt: new Date(),
    ensembles: ensemble.length > 0 ? models : [],
  }
}

const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Setříděné hodnoty členů ansámblu po hodinách, naindexované časem. */
type MemberSeries = Record<(typeof ENSEMBLE_VARS)[number], number[][]>

function memberSeries(raw: RawLocation | undefined): { times: string[]; series: MemberSeries } {
  const times = (raw?.hourly?.time as unknown as string[]) ?? []
  const series = {} as MemberSeries
  for (const v of ENSEMBLE_VARS) {
    // Klíče vypadají jako `precipitation_member07_icon_d2_eps`, řídicí člen bez `_memberNN`.
    const keys = Object.keys(raw?.hourly ?? {}).filter((k) => k.startsWith(`${v}_`))
    series[v] = times.map((_, i) => {
      const vals: number[] = []
      for (const k of keys) {
        const x = raw?.hourly?.[k]?.[i]
        if (typeof x === 'number' && Number.isFinite(x)) vals.push(x)
      }
      return vals.sort((a, b) => a - b)
    })
  }
  return { times, series }
}

/**
 * Z jemného modelu a z ansámblu udělá jednu řadu hodin: ukazované hodnoty z modelu,
 * rizikové kvantily z ansámblu. Riziková hodnota je vždycky ta horší z obou — ostrý
 * jemný model se nesmí ztratit v ansámblu hrubších členů a chvost ansámblu se nesmí
 * ztratit za jedním hezkým scénářem.
 */
function mergePoint(
  waypoint: Waypoint,
  raw: RawLocation | undefined,
  ensembleRaw: RawLocation | undefined,
  airRaw: RawLocation | undefined,
): PointForecast {
  const times = (raw?.hourly?.time as unknown as string[]) ?? []
  const { times: ensTimes, series } = memberSeries(ensembleRaw)
  const ensIndex = new Map(ensTimes.map((t, i) => [t, i]))
  const airTimes = (airRaw?.hourly?.time as unknown as string[]) ?? []
  const airIndex = new Map(airTimes.map((t, i) => [t, i]))

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
    const e = ensIndex.get(times[i])
    const members = (v: (typeof ENSEMBLE_VARS)[number]): number[] =>
      e === undefined ? [] : series[v][e] ?? []

    const apparent = at('apparent_temperature', i, at('temperature_2m', i))
    const precip = at('precipitation', i)
    const snow = at('snowfall', i)
    const gusts = at('wind_gusts_10m', i)
    const cape = at('cape', i)

    const mApparent = members('apparent_temperature')
    const mPrecip = members('precipitation')
    const mSnow = members('snowfall')
    const mGusts = members('wind_gusts_10m')
    const mCape = members('cape')

    const worse = (deterministic: number, ens: number[], p: number) =>
      ens.length === 0 ? deterministic : Math.max(deterministic, quantile(ens, p))
    const colder = (deterministic: number, ens: number[], p: number) =>
      ens.length === 0 ? deterministic : Math.min(deterministic, quantile(ens, p))

    hours.push({
      time: times[i],
      temperature: at('temperature_2m', i),
      apparentTemperature: apparent,
      apparentTemperatureRisk: colder(apparent, mApparent, 0.25),
      precipitation: precip,
      precipitationRisk: worse(precip, mPrecip, 0.75),
      precipitationProbability:
        mPrecip.length > 0
          ? (100 * mPrecip.filter((v) => v > WET_MM).length) / mPrecip.length
          : precip > WET_MM
            ? 100
            : 0,
      snowfall: snow,
      snowfallRisk: worse(snow, mSnow, 0.75),
      windSpeed: at('wind_speed_10m', i),
      windGusts: gusts,
      windGustsRisk: worse(gusts, mGusts, 0.75),
      windGustsHigh: worse(gusts, mGusts, 0.9),
      cape,
      capeRisk: worse(cape, mCape, 0.75),
      cloudCover: at('cloud_cover', i),
      cloudLow: at('cloud_cover_low', i),
      cloudMid: at('cloud_cover_mid', i),
      cloudHigh: at('cloud_cover_high', i),
      visibility: maybeAt('visibility', i),
      freezingLevel: maybeAt('freezing_level_height', i),
      snowDepth: at('snow_depth', i),
      humidity: at('relative_humidity_2m', i, 60),
      uvIndex: at('uv_index', i),
      levels: levelsAt(raw, i),
      aerosol: aerosolAt(airRaw, airIndex.get(times[i])),
      members: mPrecip.length,
    })

    const width = (vals: number[]) =>
      vals.length < 2 ? 0 : quantile(vals, 0.9) - quantile(vals, 0.1)
    spread.push({
      temperature: width(mApparent),
      windGusts: width(mGusts),
      precipitation: width(mPrecip),
      members: mPrecip.length,
    })
  }

  return { waypointId: waypoint.id, hours, spread }
}

/** Teplotní profil v dané hodině, setříděný od země nahoru. */
function levelsAt(raw: RawLocation | undefined, i: number): HourPoint['levels'] {
  const out: HourPoint['levels'] = []
  for (const hpa of LEVELS_HPA) {
    const temperature = raw?.hourly?.[`temperature_${hpa}hPa`]?.[i]
    const height = raw?.hourly?.[`geopotential_height_${hpa}hPa`]?.[i]
    if (typeof temperature === 'number' && typeof height === 'number') {
      out.push({ height, temperature })
    }
  }
  return out.sort((a, b) => a.height - b.height)
}

function aerosolAt(raw: RawLocation | undefined, index: number | undefined): number | null {
  if (raw === undefined || index === undefined) return null
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
