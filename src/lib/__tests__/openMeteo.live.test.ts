import { describe, expect, it } from 'vitest'
import { fetchForecast, modelsFor } from '../openMeteo'
import { scoreHour } from '../score'
import type { Waypoint } from '../types'

const KRKONOSE: Waypoint[] = [
  { id: 'a', name: 'Pec pod Sněžkou', lat: 50.6903, lon: 15.7322, elevation: 769 },
  { id: 'b', name: 'Růžová hora', lat: 50.7253, lon: 15.7397, elevation: 1390 },
  { id: 'c', name: 'Sněžka', lat: 50.7361, lon: 15.7397, elevation: 1603 },
]

describe('výběr modelů', () => {
  it('Krkonoše dostanou ICON-D2', () => {
    expect(modelsFor(50.74, 15.74)[0]).toBe('icon_d2')
  })
  it('v Alpách se použijí oba jemné modely naráz', () => {
    for (const [lat, lon] of [[46.02, 7.75], [45.92, 6.87]] as const) {
      expect(modelsFor(lat, lon)).toContain('meteoswiss_icon_ch1')
      expect(modelsFor(lat, lon)).toContain('arome_france_hd')
    }
  })
  it('Pyreneje jsou mimo alpský box a berou AROME', () => {
    expect(modelsFor(42.7, 0.65)[0]).toBe('arome_france_hd')
  })
  it('mimo Evropu se sáhne po globálních modelech', () => {
    expect(modelsFor(-33.9, 18.4)).toContain('ecmwf_ifs025')
  })
})

describe('živé Open-Meteo', () => {
  it('vrátí sedm dní pro všechny body v jednom kole', { timeout: 30000 }, async () => {
    const f = await fetchForecast(KRKONOSE, 7)

    expect(f.points).toHaveLength(3)
    expect(f.days).toHaveLength(7)
    expect(f.days[0].sunrise).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    expect(f.days[0].sunset).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)

    for (const p of f.points) {
      expect(p.hours.length).toBeGreaterThanOrEqual(24 * 6)
      expect(p.models.length).toBeGreaterThanOrEqual(3)
      expect(p.spread).toHaveLength(p.hours.length)
    }

    // Nadmořská výška se opravdu promítá: vrchol musí být chladnější než údolí.
    const i = 12
    const [pec, ruzova, snezka] = f.points
    expect(snezka.hours[i].temperature).toBeLessThan(pec.hours[i].temperature)
    expect(ruzova.hours[i].temperature).toBeLessThan(pec.hours[i].temperature)

    // Shoda modelů je smysluplné procento.
    const agreement = snezka.spread[i].agreement
    expect(agreement).toBeGreaterThanOrEqual(0)
    expect(agreement).toBeLessThanOrEqual(100)

    // Skórování hodinu z živých dat unese.
    const s = scoreHour(snezka.hours[i], KRKONOSE[2])
    expect(s.score).toBeGreaterThanOrEqual(0)
    expect(s.score).toBeLessThanOrEqual(100)

    // Oblačnost po vrstvách a UV musí dorazit — bez nich nejde východ a západ.
    const h = snezka.hours[i]
    expect(h.cloudLow + h.cloudMid + h.cloudHigh).toBeGreaterThanOrEqual(0)
    expect(Number.isFinite(h.uvIndex)).toBe(true)
  })
})
