import { suggestGear, type GearItem } from './gear'
import {
  breakIndexOf,
  exitMinutes,
  planFromTrack,
  snowProfileOf,
  type PaceLike,
  type RoutePlan,
  type SnowProfile,
} from './pace'
import { certaintyOf, scoreRoute, EXPOSED_ABOVE_M, type RouteScore } from './score'
import { scoreSky, type SkyScore } from './sky'
import { siteIndexByPoint } from './sites'
import type { Track } from './routing'
import type { Forecast } from './openMeteo'
import type { ForecastSite, HourPoint, PointForecast, Route, Spread, Waypoint } from './types'

/** Trasa, jak se s ní počítá: uložená trasa plus osobní kalibrace tempa. */
export type PlannedRoute = Route & PaceLike

/** Index hodiny v předpovědi pro daný okamžik. Řady jsou souvisle po hodinách. */
export function hourIndex(hours: HourPoint[], at: Date): number {
  if (hours.length === 0) return 0
  const t0 = new Date(hours[0].time).getTime()
  const i = Math.round((at.getTime() - t0) / 3_600_000)
  return Math.max(0, Math.min(hours.length - 1, i))
}

/** Teplota klesá s výškou zhruba o 6,5 °C na kilometr. */
const LAPSE_PER_M = -0.0065

export interface PassPoint {
  waypoint: Waypoint
  at: Date
  leaveAt?: Date
  hour: HourPoint
}

/**
 * Jedna hodina túry: kde v tu hodinu jsi a jaké tam je počasí. Skóre se počítá
 * z těchto vzorků, ne z časů příchodu do bodů trasy.
 */
export interface Sample {
  at: Date
  /** Místo na trati: jméno úseku, skutečná výška trati. */
  where: Waypoint
  /** Index v trati — kvůli grafu a mapě. */
  trackIndex: number
  hour: HourPoint
  spread: Spread
  /** Skóre téhle hodiny (0—100). */
  score: number
}

/** Kdy na trase začne být bouřkové riziko a co z toho plyne pro obrat. */
export interface StormWindow {
  from: Date
  /** Minut z nejvyššího bodu pod hranici lesa, kratším z obou směrů. */
  exitMin: number
  /** Nejpozdější obrat na vrcholu, abys byl v úkrytu, než to přijde. */
  turnaround: Date
  /** Nejpozdější start, aby se obrat stihl. */
  latestStart: Date
  /** Kde je nejvyšší bod, ke kterému se obrat vztahuje. */
  summit: string
}

export interface Assessment {
  start: Date
  end: Date
  plan: RoutePlan
  score: RouteScore
  /** Časy příchodu do bodů trasy. Pro výpis, ne pro skóre. */
  passes: PassPoint[]
  /** Hodina po hodině po celé túře. Z tohohle se skóruje. */
  samples: Sample[]
  /** Jak moc se skóre hýbe v rozptylu ansámblu. Null = ansámbl nedorazil. */
  certainty: number | null
  /** Nejširší rozptyl ansámblu na trase. */
  spread: { temperature: number; windGusts: number; precipitation: number }
  gear: GearItem[]
  sunrise: Date | null
  sunset: Date | null
  startsBeforeSunrise: boolean
  endsAfterSunset: boolean
  /** Minut mezi koncem túry a západem slunce. Negativní = vracíš se po tmě. */
  daylightReserveMin: number | null
  storm: StormWindow | null
  /** Kolik napadlo před startem — bahno, mokré kameny, brody. */
  wetGround: { mm24: number; mm48: number }
}

/**
 * Trasa tak, jak se opravdu jde. U túry tam a zpět se každý bod kromě obrátky
 * míjí dvakrát; trať návrat už obsahuje, tady se k ní dorovná seznam bodů.
 */
export function walkedRoute<R extends Route>(route: R): R {
  if (!route.roundTrip || route.waypoints.length < 2) return route
  return { ...route, waypoints: [...route.waypoints, ...route.waypoints.slice(0, -1).reverse()] }
}

function withStart<R extends Route>(route: R, start: Date): R {
  const hh = String(start.getHours()).padStart(2, '0')
  const mm = String(start.getMinutes()).padStart(2, '0')
  return { ...route, startTime: `${hh}:${mm}` }
}

/**
 * Model trasy pro výpočty: ke každému bodu trati místo předpovědi, které k němu
 * patří. Počítá se jednou na dvojici trať + předpověď — „Kdy jít" volá posouzení
 * stokrát a víckrát a pokaždé by to bylo znovu.
 */
interface Model {
  siteOf: Int16Array
  byId: Map<string, PointForecast>
  sites: ForecastSite[]
  highestSite: ForecastSite | null
}

const models = new WeakMap<Track, WeakMap<Forecast, Model>>()

function modelOf(track: Track, forecast: Forecast): Model {
  let inner = models.get(track)
  if (!inner) {
    inner = new WeakMap()
    models.set(track, inner)
  }
  const hit = inner.get(forecast)
  if (hit) return hit
  const sites = forecast.sites ?? []
  const model: Model = {
    siteOf: siteIndexByPoint(track.points, sites, track.turnIndex),
    byId: new Map(forecast.points.map((p) => [p.siteId, p])),
    sites,
    highestSite: sites.reduce<ForecastSite | null>((a, s) => (!a || s.elevation > a.elevation ? s : a), null),
  }
  inner.set(forecast, model)
  return model
}

/** Hodina předpovědi pro bod trati, s teplotou přepočtenou na jeho skutečnou výšku. */
function hourAt(model: Model, track: Track, idx: number, at: Date): { hour: HourPoint; spread: Spread } | null {
  const siteIdx = model.siteOf[Math.max(0, Math.min(idx, model.siteOf.length - 1))]
  const site = model.sites[siteIdx]
  const pf = site ? model.byId.get(site.id) : undefined
  if (!site || !pf || pf.hours.length === 0) return null
  const i = hourIndex(pf.hours, at)
  const hour = pf.hours[i]
  const dz = (track.points[idx]?.elevation ?? site.elevation) - site.elevation
  if (Math.abs(dz) < 25) return { hour, spread: pf.spread[i] }
  const dt = dz * LAPSE_PER_M
  return {
    hour: {
      ...hour,
      temperature: hour.temperature + dt,
      apparentTemperature: hour.apparentTemperature + dt,
      apparentTemperatureRisk: hour.apparentTemperatureRisk + dt,
    },
    spread: pf.spread[i],
  }
}

/** Výška sněhu podle nadmořské výšky, naměřená v místech předpovědi v hodinu startu. */
function snowAt(model: Model, start: Date): SnowProfile {
  const samples = model.sites.flatMap((s) => {
    const pf = model.byId.get(s.id)
    if (!pf || pf.hours.length === 0) return []
    return [{ elevation: s.elevation, depthM: pf.hours[hourIndex(pf.hours, start)].snowDepth }]
  })
  return snowProfileOf(samples)
}

/** Celé hodiny mezi startem a cílem, plus oba krajní časy. */
function stampsBetween(start: Date, end: Date): Date[] {
  const out = [new Date(start)]
  const cursor = new Date(start)
  cursor.setMinutes(60, 0, 0)
  while (cursor < end) {
    out.push(new Date(cursor))
    cursor.setTime(cursor.getTime() + 3_600_000)
  }
  if (end.getTime() > start.getTime()) out.push(new Date(end))
  return out
}

/** Kde na trati jsi po `offsetMin` minutách. Vrací index bodu trati. */
export function indexAtMinute(elapsed: number[], offsetMin: number): number {
  if (elapsed.length === 0) return 0
  let lo = 0
  let hi = elapsed.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (elapsed[mid] < offsetMin) lo = mid + 1
    else hi = mid
  }
  return lo
}

/** Jméno místa: v bodě trasy (i během pauzy) jeho název, mezi body úsek „A → B". */
function placeName(route: Route, plan: RoutePlan, offsetMin: number): string {
  const arrivals = plan.arrivals
  if (arrivals.length === 0) return route.name
  const near = arrivals.find((a) => {
    const leave = a.leaveAt ? a.offsetMin + (a.leaveAt.getTime() - a.at.getTime()) / 60000 : a.offsetMin
    return offsetMin >= a.offsetMin - 8 && offsetMin <= leave + 8
  })
  if (near) return near.waypoint.name
  for (let i = 1; i < arrivals.length; i++) {
    if (offsetMin < arrivals[i].offsetMin) {
      return `${arrivals[i - 1].waypoint.name} → ${arrivals[i].waypoint.name}`
    }
  }
  return arrivals[arrivals.length - 1].waypoint.name
}

/** Kompletní posouzení jednoho konkrétního času startu. */
export function assess(route: PlannedRoute, track: Track, forecast: Forecast, start: Date): Assessment {
  const model = modelOf(track, forecast)
  const snow = snowAt(model, start)
  const walked = walkedRoute(route)
  const plan = planFromTrack(track, withStart(walked, start), start, snow)
  const end = new Date(start.getTime() + plan.minutes * 60000)

  const passes: PassPoint[] = plan.arrivals.flatMap((a, i) => {
    const h = hourAt(model, track, track.waypointIndices[i] ?? 0, a.at)
    return h ? [{ waypoint: a.waypoint, at: a.at, leaveAt: a.leaveAt, hour: h.hour }] : []
  })

  const raw = stampsBetween(start, end).flatMap((at) => {
    const offsetMin = (at.getTime() - start.getTime()) / 60000
    const idx = indexAtMinute(plan.elapsed, offsetMin)
    const h = hourAt(model, track, idx, at)
    if (!h) return []
    const p = track.points[idx]
    return [
      {
        at,
        trackIndex: idx,
        where: {
          id: `t${idx}`,
          name: placeName(walked, plan, offsetMin),
          lat: p?.lat ?? 0,
          lon: p?.lon ?? 0,
          elevation: p?.elevation ?? 0,
        },
        hour: h.hour,
        spread: h.spread,
      },
    ]
  })

  const score = scoreRoute(raw.map((s) => ({ waypoint: s.where, hour: s.hour })))
  const samples: Sample[] = raw.map((s, i) => ({ ...s, score: score.hourly[i]?.score ?? 0 }))

  const certainties = samples
    .map((s) => certaintyOf(s.hour, s.spread, s.where))
    .filter((c): c is number => c !== null)
  const certainty = certainties.length
    ? Math.round(certainties.reduce((a, b) => a + b, 0) / certainties.length)
    : null

  // Ukazuje se nejširší rozptyl na trase: nejistota patří k té hodině, kde je největší.
  const spread = samples.reduce(
    (acc, s) => ({
      temperature: Math.max(acc.temperature, s.spread.temperature),
      windGusts: Math.max(acc.windGusts, s.spread.windGusts),
      precipitation: Math.max(acc.precipitation, s.spread.precipitation),
    }),
    { temperature: 0, windGusts: 0, precipitation: 0 },
  )

  const day = dayOf(forecast, start)
  const sunrise = day ? new Date(day.sunrise) : null
  const sunset = day ? new Date(day.sunset) : null
  const startsBeforeSunrise = sunrise ? start < sunrise : false
  const endsAfterSunset = sunset ? end > sunset : false
  const daylightReserveMin = sunset ? Math.round((sunset.getTime() - end.getTime()) / 60000) : null

  const storm = stormWindowOf(route, track, model, plan, start, end, snow)
  const wetGround = wetnessBefore(forecast, start)
  const top = track.points.reduce((a, p) => (p.elevation > a ? p.elevation : a), -Infinity)
  const highest = [...route.waypoints].sort((a, b) => b.elevation - a.elevation)[0]

  // Bez jediné hodiny předpovědi se výbava neradí. Prázdné pole by přes Math.min
  // propadlo jako nula stupňů a appka by si vymyslela čepici a rukavice.
  const gear =
    samples.length === 0
      ? []
      : suggestGear({
          minApparent: min(samples.map((s) => s.hour.apparentTemperatureRisk)),
          maxGusts: max(samples.map((s) => s.hour.windGustsRisk)),
          totalPrecip: score.rainMm,
          maxPrecipProbability: max(samples.map((s) => s.hour.precipitationProbability)),
          maxUv: max(samples.map((s) => s.hour.uvIndex)),
          minVisibility: minVisibility(samples),
          maxSnowDepth: max(samples.map((s) => s.hour.snowDepth)),
          anyIcing: samples.some(
            (s) =>
              s.hour.freezingLevel !== null &&
              s.hour.freezingLevel < s.where.elevation &&
              s.hour.precipitationRisk > 0.2,
          ),
          startsBeforeSunrise,
          endsAfterSunset,
          durationMin: plan.minutes,
          highestName: highest?.name ?? '',
          highestElevation: Math.round(Number.isFinite(top) ? top : (highest?.elevation ?? 0)),
        })

  return {
    start,
    end,
    plan,
    score,
    passes,
    samples,
    certainty,
    spread,
    gear,
    sunrise,
    sunset,
    startsBeforeSunrise,
    endsAfterSunset,
    daylightReserveMin,
    storm,
    wetGround,
  }
}

/**
 * Kdy na trase začne bouřkové riziko a kolik času zbývá na sestup z hřebene.
 * Prahy: CAPE nad 500 s aspoň čtyřiceti procenty scénářů, ve kterých prší, nebo
 * CAPE nad 800 bez ohledu na srážky — energie tam je a stačí spouštěč.
 */
function stormWindowOf(
  route: PlannedRoute,
  track: Track,
  model: Model,
  plan: RoutePlan,
  start: Date,
  end: Date,
  snow: SnowProfile,
): StormWindow | null {
  const site = model.highestSite
  if (!site || site.elevation < EXPOSED_ABOVE_M) return null
  const pf = model.byId.get(site.id)
  if (!pf || pf.hours.length === 0) return null

  // Nejvyšší bod na chozené trati (u tam a zpět ten první průchod).
  const summitIdx = track.points.reduce(
    (best, p, i, arr) => (p.elevation > arr[best].elevation ? i : best),
    0,
  )
  const from = hourIndex(pf.hours, start)
  // Tři hodiny po návratu se ještě sledují: „vejdeš se před bouřku" je stejně
  // užitečná informace jako „nevejdeš".
  const until = hourIndex(pf.hours, new Date(end.getTime() + 3 * 3_600_000))
  for (let i = from; i <= until; i++) {
    const h = pf.hours[i]
    const risky = (h.capeRisk >= 500 && h.precipitationProbability >= 40) || h.capeRisk >= 800
    if (!risky) continue

    const exitMin = exitMinutes(track, summitIdx, EXPOSED_ABOVE_M, route, snow)
    if (!Number.isFinite(exitMin)) return null

    const at = new Date(h.time)
    const turnaround = new Date(at.getTime() - exitMin * 60000)
    // Pauza nahoře se do času obratu počítá: nahoře sedíš, ale ještě nejsi dole.
    const pause = plan.breakMin > 0 && breakIndexOf(track) === summitIdx ? plan.breakMin : 0
    const summitOffset = (plan.elapsed[summitIdx] ?? 0) + pause
    const nearest = [...route.waypoints].sort(
      (a, b) => Math.abs(a.elevation - site.elevation) - Math.abs(b.elevation - site.elevation),
    )[0]
    return {
      from: at,
      exitMin: Math.round(exitMin),
      turnaround,
      latestStart: new Date(turnaround.getTime() - summitOffset * 60000),
      summit: nearest?.name ?? route.name,
    }
  }
  return null
}

/**
 * Kolik spadlo na trasu před startem. Rozmočená pěšina, klouzavé kameny a brody
 * po vydatném dešti jsou věc, kterou předpověď na samotný den túry neřekne.
 */
function wetnessBefore(forecast: Forecast, start: Date): { mm24: number; mm48: number } {
  let mm24 = 0
  let mm48 = 0
  for (const p of forecast.points) {
    let a = 0
    let b = 0
    for (const h of p.hours) {
      const t = new Date(h.time).getTime()
      const hoursBefore = (start.getTime() - t) / 3_600_000
      if (hoursBefore <= 0) continue
      if (hoursBefore <= 24) a += h.precipitation
      if (hoursBefore <= 48) b += h.precipitation
    }
    mm24 = Math.max(mm24, a)
    mm48 = Math.max(mm48, b)
  }
  return { mm24, mm48 }
}

const min = (xs: number[]) => (xs.length ? Math.min(...xs) : 0)
const max = (xs: number[]) => (xs.length ? Math.max(...xs) : 0)
const minVisibility = (samples: Sample[]) => {
  const vs = samples.map((s) => s.hour.visibility).filter((v): v is number => v !== null)
  return vs.length ? Math.min(...vs) : null
}

export const dayKey = (at: Date) =>
  `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`

function dayOf(forecast: Forecast, at: Date) {
  const key = dayKey(at)
  return forecast.days.find((d) => d.date === key)
}

/** Hodiny předpovědi v nejvyšším místě trati — pro oblohu, inverzi a zákal. */
export function summitHours(track: Track, forecast: Forecast): { site: ForecastSite; hours: HourPoint[] } | null {
  const model = modelOf(track, forecast)
  const site = model.highestSite
  const pf = site ? model.byId.get(site.id) : undefined
  return site && pf ? { site, hours: pf.hours } : null
}

export interface DayOutlook {
  date: string
  /** Skóre trasy podle hodiny startu; null = mimo denní světlo nebo v minulosti. */
  hourly: Array<number | null>
  best: { start: Date; score: number; endsAt: Date } | null
  sunrise: SkyScore & { at: Date }
  sunset: SkyScore & { at: Date }
}

/**
 * Pro každý den prozkoumá všechny hodiny startu a řekne, která je nejlepší.
 * Neptáš se „jaké bude v sobotu", ale „kdy přesně mám vyrazit".
 */
export function weekOutlook(route: PlannedRoute, track: Track, forecast: Forecast): DayOutlook[] {
  const now = new Date()
  const summit = summitHours(track, forecast)?.hours ?? forecast.points[0]?.hours ?? []

  return forecast.days.map((day) => {
    const sunrise = new Date(day.sunrise)
    const sunset = new Date(day.sunset)
    const hourly: Array<number | null> = []
    let best: DayOutlook['best'] = null

    for (let h = 0; h < 24; h++) {
      const start = new Date(sunrise)
      start.setHours(h, 0, 0, 0)

      // Startovat po setmění, vracet se dlouho po západu ani vyrážet v čase,
      // který už dávno minul, nedává smysl. Levná kontrola jde před drahým výpočtem.
      if (start < now || start < addMinutes(sunrise, -60) || start > sunset) {
        hourly.push(null)
        continue
      }
      const a = assess(route, track, forecast, start)
      if (a.end > addMinutes(sunset, 30)) {
        hourly.push(null)
        continue
      }

      hourly.push(a.score.score)
      if (!best || a.score.score > best.score) {
        best = { start, score: a.score.score, endsAt: a.end }
      }
    }

    return {
      date: day.date,
      hourly,
      best,
      sunrise: { ...skyAt(summit, sunrise), at: sunrise },
      sunset: { ...skyAt(summit, sunset), at: sunset },
    }
  })
}

function skyAt(hours: HourPoint[], at: Date): SkyScore {
  if (hours.length === 0) {
    return { score: 0, label: 'nic moc', reason: 'Chybí data.', layers: { high: 0, mid: 0, low: 0 } }
  }
  return scoreSky(hours[hourIndex(hours, at)])
}

const addMinutes = (d: Date, m: number) => new Date(d.getTime() + m * 60000)
