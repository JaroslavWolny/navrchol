import { suggestGear, type GearItem } from './gear'
import { exitMinutes, planFromTrack, snowProfileOf, type RoutePlan, type SnowProfile } from './pace'
import { certaintyOf, scoreRoute, EXPOSED_ABOVE_M, type RouteScore } from './score'
import { scoreSky, type SkyScore } from './sky'
import type { Track } from './routing'
import type { Forecast } from './openMeteo'
import type { HourPoint, PointForecast, Route, Spread, Waypoint } from './types'

/** Index hodiny v předpovědi pro daný okamžik. Řady jsou souvisle po hodinách. */
function hourIndex(hours: HourPoint[], at: Date): number {
  if (hours.length === 0) return 0
  const t0 = new Date(hours[0].time).getTime()
  const i = Math.round((at.getTime() - t0) / 3_600_000)
  return Math.max(0, Math.min(hours.length - 1, i))
}

export interface PassPoint {
  waypoint: Waypoint
  at: Date
  hour: HourPoint
}

/**
 * Jedna hodina túry: kde v tu hodinu jsi a jaké tam je počasí. Skóre se počítá
 * z těchto vzorků, ne z časů příchodu do bodů trasy — trasa o dvou bodech na šest
 * hodin by jinak měla oskórované dvě hodiny ze šesti a bouřka mezi nimi by
 * do verdiktu vůbec nepromluvila.
 */
export interface Sample {
  at: Date
  /** Nejbližší bod trasy, ale s výškou ze skutečné trati — kvůli exponovanosti. */
  where: Waypoint
  hour: HourPoint
  spread: Spread
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
}

export interface Assessment {
  start: Date
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
  startsBeforeSunrise: boolean
  endsAfterSunset: boolean
  /** Minut mezi koncem túry a západem slunce. Negativní = vracíš se po tmě. */
  daylightReserveMin: number | null
  storm: StormWindow | null
  /** Kolik napadlo před startem — bahno, mokré kameny, brody. */
  wetGround: { mm24: number; mm48: number }
}

function withStart(route: Route, start: Date): Route {
  const hh = String(start.getHours()).padStart(2, '0')
  const mm = String(start.getMinutes()).padStart(2, '0')
  return { ...route, startTime: `${hh}:${mm}` }
}

/** Výška sněhu podle nadmořské výšky, naměřená v bodech trasy v hodinu startu. */
function snowAt(route: Route, byId: Map<string, PointForecast>, start: Date): SnowProfile {
  const samples = route.waypoints.flatMap((w) => {
    const pf = byId.get(w.id)
    if (!pf || pf.hours.length === 0) return []
    return [{ elevation: w.elevation, depthM: pf.hours[hourIndex(pf.hours, start)].snowDepth }]
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

/**
 * Kde na trati jsi po `offsetMin` minutách chůze. Vrací index bodu trati —
 * z něj plyne skutečná výška, a tedy i to, jestli jsi v tu hodinu na hřebeni.
 */
function indexAtMinute(elapsed: number[], offsetMin: number): number {
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

/** Jméno místa: v bodě trasy jeho název, mezi body úsek „A → B". */
function placeName(route: Route, plan: RoutePlan, offsetMin: number): string {
  const arrivals = plan.arrivals
  if (arrivals.length === 0) return route.name
  const near = arrivals.find((a) => Math.abs(a.offsetMin - offsetMin) <= 8)
  if (near) return near.waypoint.name
  for (let i = 1; i < arrivals.length; i++) {
    if (offsetMin < arrivals[i].offsetMin) {
      return `${arrivals[i - 1].waypoint.name} → ${arrivals[i].waypoint.name}`
    }
  }
  return arrivals[arrivals.length - 1].waypoint.name
}

/** Kompletní posouzení jednoho konkrétního času startu. */
export function assess(
  route: Route,
  track: Track,
  forecast: Forecast,
  start: Date,
): Assessment {
  const byId = new Map(forecast.points.map((p) => [p.waypointId, p]))
  const snow = snowAt(route, byId, start)
  const plan = planFromTrack(track, withStart(route, start), start, snow)

  const passes: PassPoint[] = plan.arrivals.flatMap((a) => {
    const pf = byId.get(a.waypoint.id)
    if (!pf || pf.hours.length === 0) return []
    return [{ waypoint: a.waypoint, at: a.at, hour: pf.hours[hourIndex(pf.hours, a.at)] }]
  })

  const end = plan.arrivals.at(-1)?.at ?? start
  const samples: Sample[] = stampsBetween(start, end).flatMap((at) => {
    const offsetMin = (at.getTime() - start.getTime()) / 60000
    const idx = indexAtMinute(plan.elapsed, offsetMin)
    // Předpověď je jen v bodech trasy. Pro hodinu mezi nimi se vezme ta z nejbližšího
    // bodu, ale exponovanost se posuzuje ze skutečné výšky trati — hřeben mezi dvěma
    // waypointy je hřeben, i když tam žádný waypoint není.
    const nearest = nearestWaypoint(route, track, idx)
    const pf = byId.get(nearest.id)
    if (!pf || pf.hours.length === 0) return []
    const i = hourIndex(pf.hours, at)
    const elevation = track.points[idx]?.elevation ?? nearest.elevation
    return [
      {
        at,
        where: { ...nearest, name: placeName(route, plan, offsetMin), elevation },
        hour: pf.hours[i],
        spread: pf.spread[i],
      },
    ]
  })

  const score = scoreRoute(samples.map((s) => ({ waypoint: s.where, hour: s.hour })))

  const certainties = samples
    .map((s) => certaintyOf(s.hour, s.spread, s.where))
    .filter((c): c is number => c !== null)
  const certainty = certainties.length
    ? Math.round(certainties.reduce((a, b) => a + b, 0) / certainties.length)
    : null

  // Ukazuje se nejširší rozptyl na trase, ne ten v hodině startu: nejistota
  // patří k té hodině, kde je největší, protože ta rozhoduje.
  const spread = samples.reduce(
    (acc, s) => ({
      temperature: Math.max(acc.temperature, s.spread.temperature),
      windGusts: Math.max(acc.windGusts, s.spread.windGusts),
      precipitation: Math.max(acc.precipitation, s.spread.precipitation),
    }),
    { temperature: 0, windGusts: 0, precipitation: 0 },
  )

  const day = dayOf(forecast, start)
  const sunset = day ? new Date(day.sunset) : null
  const startsBeforeSunrise = day ? start < new Date(day.sunrise) : false
  const endsAfterSunset = sunset ? end > sunset : false
  const daylightReserveMin = sunset ? Math.round((sunset.getTime() - end.getTime()) / 60000) : null

  const highest = [...route.waypoints].sort((a, b) => b.elevation - a.elevation)[0]
  const storm = stormWindowOf(route, track, byId, plan, start, end, snow, highest)

  const wetGround = wetnessBefore(forecast, start)

  // Bez jediné hodiny předpovědi se výbava neradí. Prázdné pole by přes Math.min
  // propadlo jako nula stupňů a appka by si vymyslela čepici a rukavice.
  const gear = samples.length === 0 ? [] : suggestGear({
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
    highestElevation: Math.round(highest?.elevation ?? 0),
  })

  return {
    start,
    plan,
    score,
    passes,
    samples,
    certainty,
    spread,
    gear,
    startsBeforeSunrise,
    endsAfterSunset,
    daylightReserveMin,
    storm,
    wetGround,
  }
}

/** Ke kterému bodu trasy je daný index trati nejblíž. */
function nearestWaypoint(route: Route, track: Track, idx: number): Waypoint {
  let best = route.waypoints[0]
  let bestDist = Infinity
  route.waypoints.forEach((w, i) => {
    const d = Math.abs((track.waypointIndices[i] ?? 0) - idx)
    if (d < bestDist) {
      bestDist = d
      best = w
    }
  })
  return best
}

/**
 * Kdy na trase začne bouřkové riziko a kolik času zbývá na sestup z hřebene.
 * Prahy: CAPE nad 500 s aspoň čtyřiceti procenty členů, kterým prší, nebo CAPE
 * nad 800 bez ohledu na srážky — energie tam je a stačí spouštěč.
 */
function stormWindowOf(
  route: Route,
  track: Track,
  byId: Map<string, PointForecast>,
  plan: RoutePlan,
  start: Date,
  end: Date,
  snow: SnowProfile,
  highest: Waypoint | undefined,
): StormWindow | null {
  if (!highest) return null
  const pf = byId.get(highest.id)
  if (!pf || pf.hours.length === 0) return null
  if (highest.elevation < EXPOSED_ABOVE_M) return null

  const from = hourIndex(pf.hours, start)
  // Tři hodiny po návratu se ještě sledují: „vejdeš se před bouřku" je stejně
  // užitečná informace jako „nevejdeš", a obě se dají říct jen s tímhle přesahem.
  const until = hourIndex(pf.hours, new Date(end.getTime() + 3 * 3_600_000))
  for (let i = from; i <= until; i++) {
    const h = pf.hours[i]
    const risky = (h.capeRisk >= 500 && h.precipitationProbability >= 40) || h.capeRisk >= 800
    if (!risky) continue

    const summitIdx = track.waypointIndices[route.waypoints.indexOf(highest)] ?? 0
    const exitMin = exitMinutes(track, summitIdx, EXPOSED_ABOVE_M, route.pace, snow)
    if (!Number.isFinite(exitMin)) return null

    const at = new Date(h.time)
    const turnaround = new Date(at.getTime() - exitMin * 60000)
    const summitOffset = plan.arrivals.find((a) => a.waypoint.id === highest.id)?.offsetMin ?? 0
    return {
      from: at,
      exitMin: Math.round(exitMin),
      turnaround,
      latestStart: new Date(turnaround.getTime() - summitOffset * 60000),
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

function dayOf(forecast: Forecast, at: Date) {
  const key = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`
  return forecast.days.find((d) => d.date === key)
}

export interface DayOutlook {
  date: string
  /** Skóre trasy podle hodiny startu; null = mimo denní světlo. */
  hourly: Array<number | null>
  best: { start: Date; score: number; endsAt: Date } | null
  sunrise: SkyScore & { at: Date }
  sunset: SkyScore & { at: Date }
}

/**
 * Pro každý den prozkoumá všechny hodiny startu a řekne, která je nejlepší.
 * Tohle je ta věc, kterou běžné appky na počasí neumí: neptáš se „jaké bude v sobotu",
 * ale „kdy přesně mám vyrazit".
 */
export function weekOutlook(route: Route, track: Track, forecast: Forecast): DayOutlook[] {
  const now = new Date()
  const highest = [...route.waypoints].sort((a, b) => b.elevation - a.elevation)[0]
  const summit = forecast.points.find((p) => p.waypointId === highest?.id) ?? forecast.points[0]

  return forecast.days.map((day) => {
    const sunrise = new Date(day.sunrise)
    const sunset = new Date(day.sunset)
    const hourly: Array<number | null> = []
    let best: DayOutlook['best'] = null

    for (let h = 0; h < 24; h++) {
      const start = new Date(sunrise)
      start.setHours(h, 0, 0, 0)

      const a = assess(route, track, forecast, start)
      const end = a.plan.arrivals.at(-1)?.at ?? start
      // Startovat po setmění, vracet se dlouho po západu ani vyrážet v čase,
      // který už dávno minul, nedává smysl.
      const usable =
        start >= now && start >= addMinutes(sunrise, -60) && end <= addMinutes(sunset, 30)
      if (!usable) {
        hourly.push(null)
        continue
      }

      hourly.push(a.score.score)
      if (!best || a.score.score > best.score) {
        best = { start, score: a.score.score, endsAt: end }
      }
    }

    const summitHours = summit?.hours ?? []
    return {
      date: day.date,
      hourly,
      best,
      sunrise: { ...skyAt(summitHours, sunrise), at: sunrise },
      sunset: { ...skyAt(summitHours, sunset), at: sunset },
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
