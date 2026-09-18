import { suggestGear, type GearItem } from './gear'
import { planFromTrack, type RoutePlan } from './pace'
import { scoreRoute, type RouteScore } from './score'
import { scoreSky, type SkyScore } from './sky'
import type { Track } from './routing'
import type { Forecast } from './openMeteo'
import type { HourPoint, Route, Waypoint } from './types'

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
  agreement: number
}

export interface Assessment {
  start: Date
  plan: RoutePlan
  score: RouteScore
  passes: PassPoint[]
  /** Průměrná shoda modelů přes celou trasu. */
  agreement: number
  spread: { temperature: number; windGusts: number; precipitation: number }
  gear: GearItem[]
  startsBeforeSunrise: boolean
  endsAfterSunset: boolean
}

function withStart(route: Route, start: Date): Route {
  const hh = String(start.getHours()).padStart(2, '0')
  const mm = String(start.getMinutes()).padStart(2, '0')
  return { ...route, startTime: `${hh}:${mm}` }
}

/** Kompletní posouzení jednoho konkrétního času startu. */
export function assess(
  route: Route,
  track: Track,
  forecast: Forecast,
  start: Date,
): Assessment {
  const plan = planFromTrack(track, withStart(route, start), start)
  const byId = new Map(forecast.points.map((p) => [p.waypointId, p]))

  const passes: PassPoint[] = plan.arrivals.flatMap((a) => {
    const pf = byId.get(a.waypoint.id)
    if (!pf || pf.hours.length === 0) return []
    const i = hourIndex(pf.hours, a.at)
    return [{ waypoint: a.waypoint, at: a.at, hour: pf.hours[i], agreement: pf.spread[i].agreement }]
  })

  const score = scoreRoute(passes.map((p) => ({ waypoint: p.waypoint, hour: p.hour })))
  const agreement = passes.length
    ? Math.round(passes.reduce((s, p) => s + p.agreement, 0) / passes.length)
    : 0

  const spreadSource = forecast.points[0]
  const si = spreadSource ? hourIndex(spreadSource.hours, start) : 0
  const spread = spreadSource
    ? {
        temperature: spreadSource.spread[si].temperature,
        windGusts: spreadSource.spread[si].windGusts,
        precipitation: spreadSource.spread[si].precipitation,
      }
    : { temperature: 0, windGusts: 0, precipitation: 0 }

  const end = plan.arrivals.at(-1)?.at ?? start
  const day = dayOf(forecast, start)
  const startsBeforeSunrise = day ? start < new Date(day.sunrise) : false
  const endsAfterSunset = day ? end > new Date(day.sunset) : false

  const highest = [...route.waypoints].sort((a, b) => b.elevation - a.elevation)[0]
  // Bez jediné hodiny předpovědi se výbava neradí. Prázdné pole by přes Math.min
  // propadlo jako nula stupňů a appka by si vymyslela čepici a rukavice.
  const gear = passes.length === 0 ? [] : suggestGear({
    minApparent: min(passes.map((p) => p.hour.apparentTemperature)),
    maxGusts: max(passes.map((p) => p.hour.windGusts)),
    totalPrecip: passes.reduce((s, p) => s + p.hour.precipitation, 0),
    maxPrecipProbability: max(passes.map((p) => p.hour.precipitationProbability)),
    maxUv: max(passes.map((p) => p.hour.uvIndex)),
    minVisibility: minVisibility(passes),
    anyIcing: passes.some(
      (p) =>
        p.hour.freezingLevel !== null &&
        p.hour.freezingLevel < p.waypoint.elevation &&
        p.hour.precipitation > 0.2,
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
    agreement,
    spread,
    gear,
    startsBeforeSunrise,
    endsAfterSunset,
  }
}

const min = (xs: number[]) => (xs.length ? Math.min(...xs) : 0)
const max = (xs: number[]) => (xs.length ? Math.max(...xs) : 0)
const minVisibility = (passes: PassPoint[]) => {
  const vs = passes.map((p) => p.hour.visibility).filter((v): v is number => v !== null)
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
