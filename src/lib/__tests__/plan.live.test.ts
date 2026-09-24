import { describe, expect, it } from 'vitest'
import { fetchForecast } from '../openMeteo'
import { fetchTrack } from '../routing'
import { forecastSites } from '../sites'
import { assess, weekOutlook } from '../plan'
import type { Forecast } from '../openMeteo'
import type { Route, Waypoint } from '../types'

/** Vyčerpaný minutový limit Open-Meteo není rozbitá appka. */
async function orSkip(promise: Promise<Forecast>): Promise<Forecast | null> {
  try {
    return await promise
  } catch (e) {
    if (e instanceof Error && e.message.includes('429')) {
      console.warn('Open-Meteo hlásí limit (429), test přeskočen')
      return null
    }
    throw e
  }
}

const WPS: Waypoint[] = [
  { id: 'a', name: 'Pec pod Sněžkou', lat: 50.695, lon: 15.7392, elevation: 762 },
  { id: 'b', name: 'Růžohorky', lat: 50.7104, lon: 15.7499, elevation: 1250 },
  { id: 'c', name: 'Sněžka', lat: 50.7361, lon: 15.7397, elevation: 1603 },
]
const route: Route = {
  id: 'r',
  name: 'Sněžka z Pece',
  waypoints: WPS,
  startTime: '07:00',
  pace: 'stredni',
}

describe('celý plán na živých datech', () => {
  it('posoudí konkrétní start i celý týden', { timeout: 60000 }, async () => {
    const track = await fetchTrack(WPS)
    const sites = forecastSites(track.points)
    const forecast = await orSkip(fetchForecast(sites, 7))
    if (!forecast) return
    // Hřeben mezi Růžohorky a Sněžkou má vlastní místo předpovědi, ne jen koncové body.
    expect(sites.length).toBeGreaterThanOrEqual(3)
    expect(Math.max(...sites.map((x) => x.elevation))).toBeGreaterThan(1550)

    // Zítra v sedm. Hodinové řady začínají dva dny v minulosti (kvůli tomu, co
    // spadlo před túrou), takže se start bere ze seznamu dnů, ne z první hodiny.
    const start = new Date(`${forecast.days[1].date}T07:00:00`)

    const a = assess(route, track, forecast, start)
    expect(a.passes).toHaveLength(3)
    expect(a.score.score).toBeGreaterThanOrEqual(0)
    expect(a.score.score).toBeLessThanOrEqual(100)
    expect(['jdi', 'zvaz', 'nejdi']).toContain(a.score.verdict)
    // Ansámbl je velká odpověď a minutový limit Open-Meteo je skutečný; když
    // nedorazí, appka i tak musí dát verdikt — jen bez rezervy na horší scénář.
    if (forecast.ensembles.length > 0) {
      expect(a.certainty).not.toBeNull()
      expect(a.certainty!).toBeGreaterThanOrEqual(0)
      expect(a.certainty!).toBeLessThanOrEqual(100)
    }

    // Skóruje se hodinu po hodině po celé túře, ne jen v bodech trasy.
    expect(a.samples.length).toBeGreaterThan(a.passes.length)
    expect(a.samples[0].at.getTime()).toBe(start.getTime())
    for (let i = 1; i < a.samples.length; i++) {
      const dt = a.samples[i].at.getTime() - a.samples[i - 1].at.getTime()
      expect(dt).toBeGreaterThan(0)
      expect(dt).toBeLessThanOrEqual(3_600_000)
    }

    // Rezerva do tmy a co spadlo před startem jsou spočítané, ne vymyšlené.
    expect(a.daylightReserveMin).not.toBeNull()
    expect(a.wetGround.mm24).toBeGreaterThanOrEqual(0)
    expect(a.wetGround.mm48).toBeGreaterThanOrEqual(a.wetGround.mm24)

    // Body se míjejí v pořadí a nahoře je ve stejnou hodinu chladněji než dole.
    expect(a.passes[2].at.getTime()).toBeGreaterThan(a.passes[0].at.getTime())
    const low = forecast.points[0]
    const high = forecast.points.find((p) => p.siteId === [...sites].sort((x, y) => y.elevation - x.elevation)[0].id)!
    const k = low.hours.findIndex((h) => h.time.endsWith('T12:00')) + 24
    expect(high.hours[k].temperature).toBeLessThan(low.hours[k].temperature)

    // Výbava má u každé položky důvod.
    expect(a.gear.every((g) => g.why.length > 0)).toBe(true)

    const week = weekOutlook(route, track, forecast)
    expect(week).toHaveLength(7)
    for (const d of week) {
      expect(d.hourly).toHaveLength(24)
      expect(d.sunrise.score).toBeGreaterThanOrEqual(0)
      expect(d.sunset.score).toBeLessThanOrEqual(100)
      // V noci se nestartuje.
      expect(d.hourly[2]).toBeNull()
    }
    // Aspoň jeden den v týdnu musí mít použitelné okno.
    expect(week.some((d) => d.best !== null)).toBe(true)

    const bestDay = week.filter((d) => d.best).sort((x, y) => y.best!.score - x.best!.score)[0]
    console.log(
      `nejlepší okno: ${bestDay.date} v ${bestDay.best!.start.getHours()}:00, skóre ${bestDay.best!.score}, jistota ${a.certainty} %`,
    )
    console.log(
      `trať ${track.lengthKm.toFixed(1)} km, ↑${track.ascentM} m, ${track.fallback ? 'vzdušná čára' : 'po pěšinách'}`,
    )
  })
})

describe('neúplná data', () => {
  it('předpověď bez míst nesmí vyrobit nesmyslné hodiny ani výbavu', async () => {
    const track = await fetchTrack(WPS)
    const forecast = { sites: [], points: [], days: [], fetchedAt: Date.now(), ensembles: [] }
    const a = assess(route, track, forecast, new Date())
    expect(a.passes).toHaveLength(0)
    expect(a.samples).toHaveLength(0)
    expect(a.score.verdict).toBe('nejdi')
    expect(a.gear).toEqual([])
  })
})
