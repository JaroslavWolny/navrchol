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

    const start = new Date(forecast.points[0].hours[0].time)
    start.setDate(start.getDate() + 1)
    start.setHours(7, 0, 0, 0)

    const a = assess(route, track, forecast, start)
    expect(a.passes).toHaveLength(3)
    expect(a.score.score).toBeGreaterThanOrEqual(0)
    expect(a.score.score).toBeLessThanOrEqual(100)
    expect(['jdi', 'zvaz', 'nejdi']).toContain(a.score.verdict)
    expect(a.agreement).toBeGreaterThanOrEqual(0)
    expect(a.agreement).toBeLessThanOrEqual(100)

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
      `nejlepší okno: ${bestDay.date} v ${bestDay.best!.start.getHours()}:00, skóre ${bestDay.best!.score}, shoda ${a.agreement} %`,
    )
    console.log(
      `trať ${track.lengthKm.toFixed(1)} km, ↑${track.ascentM} m, ${track.fallback ? 'vzdušná čára' : 'po pěšinách'}`,
    )
  })
})
