import { describe, expect, it } from 'vitest'
import { fetchForecast } from '../openMeteo'
import { fetchTrack } from '../routing'
import { assess, weekOutlook } from '../plan'
import type { Route, Waypoint } from '../types'

const WPS: Waypoint[] = [
  { id: 'a', name: 'Pec pod Sněžkou', lat: 50.6903, lon: 15.7322, elevation: 769 },
  { id: 'b', name: 'Růžová hora', lat: 50.7253, lon: 15.7397, elevation: 1390 },
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
    const [track, forecast] = await Promise.all([fetchTrack(WPS), fetchForecast(WPS, 7)])

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

    // Body se míjejí v pořadí a vrchol je nejchladnější.
    expect(a.passes[2].at.getTime()).toBeGreaterThan(a.passes[0].at.getTime())
    expect(a.passes[2].hour.temperature).toBeLessThan(a.passes[0].hour.temperature)

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

describe('nesouhlasná data', () => {
  it('předpověď z jiné trasy nesmí vyrobit nesmyslné body průchodu', async () => {
    const [track, forecast] = await Promise.all([fetchTrack(WPS), fetchForecast(WPS, 2)])

    // Stejné souřadnice, jiná ID — přesně to, co vzniklo při přepnutí na novou trasu.
    const jinaTrasa: Route = {
      ...route,
      id: 'jina',
      waypoints: WPS.map((w) => ({ ...w, id: `${w.id}-nove` })),
    }

    const start = new Date(forecast.points[0].hours[0].time)
    start.setHours(start.getHours() + 3)

    const a = assess(jinaTrasa, track, forecast, start)
    // Smí vyjít prázdno, ale nesmí to spadnout ani vyrobit body bez hodiny.
    expect(a.passes).toHaveLength(0)
    expect(a.samples).toHaveLength(0)
    expect(a.passes.every((p) => p.hour !== undefined)).toBe(true)
    expect(a.score.verdict).toBe('nejdi')
    expect(a.gear).toEqual([])
  })
})
