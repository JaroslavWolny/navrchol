import { describe, expect, it } from 'vitest'
import { ensembleModelsFor, fetchForecast } from '../openMeteo'
import { haze, inversionIn } from '../inversion'
import { scoreHour } from '../score'
import type { Waypoint } from '../types'

const KRKONOSE: Waypoint[] = [
  { id: 'a', name: 'Pec pod Sněžkou', lat: 50.6903, lon: 15.7322, elevation: 769 },
  { id: 'b', name: 'Růžová hora', lat: 50.7253, lon: 15.7397, elevation: 1390 },
  { id: 'c', name: 'Sněžka', lat: 50.7361, lon: 15.7397, elevation: 1603 },
]

describe('výběr ansámblů', () => {
  it('Krkonoše dostanou jemný ICON-D2-EPS', () => {
    expect(ensembleModelsFor(50.74, 15.74)[0]).toBe('icon_d2_eps')
  })
  it('Alpy leží v doméně ICON-D2 taky', () => {
    for (const [lat, lon] of [[46.02, 7.75], [45.92, 6.87]] as const) {
      expect(ensembleModelsFor(lat, lon)).toContain('icon_d2_eps')
    }
  })
  it('Pyreneje jsou mimo, berou ICON-EU', () => {
    expect(ensembleModelsFor(42.7, 0.65)[0]).toBe('icon_eu_eps')
  })
  it('mimo Evropu se sáhne po globálních ansámblech', () => {
    expect(ensembleModelsFor(-33.9, 18.4)).toContain('ecmwf_ifs025')
    expect(ensembleModelsFor(-33.9, 18.4)).not.toContain('icon_d2_eps')
  })
})

describe('živé Open-Meteo', () => {
  it('vrátí sedm dní pro všechny body v jednom kole', { timeout: 40000 }, async () => {
    const f = await fetchForecast(KRKONOSE, 7)

    expect(f.points).toHaveLength(3)
    expect(f.days).toHaveLength(7)
    expect(f.days[0].sunrise).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    expect(f.days[0].sunset).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    // Dny dozadu se do seznamu dnů nesmějí dostat, i když hodinové řady je mají.
    expect(f.days[0].date >= new Date().toISOString().slice(0, 10)).toBe(true)

    for (const p of f.points) {
      expect(p.hours.length).toBeGreaterThanOrEqual(24 * 8)
      expect(p.spread).toHaveLength(p.hours.length)
    }

    // Nadmořská výška se opravdu promítá: vrchol musí být chladnější než údolí.
    const [pec, ruzova, snezka] = f.points
    const i = snezka.hours.findIndex((h) => h.members > 0) + 12
    expect(snezka.hours[i].temperature).toBeLessThan(pec.hours[i].temperature)
    expect(ruzova.hours[i].temperature).toBeLessThan(pec.hours[i].temperature)

    const h = snezka.hours[i]

    if (f.ensembles.length === 0) {
      console.warn('ansámbl nedorazil (minutový limit API), zbytek testu přeskočen')
      return
    }

    // Ansámbl dorazil a má desítky členů, ne čtyři modely.
    expect(h.members).toBeGreaterThan(20)
    expect(snezka.spread[i].members).toBe(h.members)

    // Riziková hodnota je vždycky ta horší z jemného modelu a kvantilu ansámblu.
    expect(h.precipitationRisk).toBeGreaterThanOrEqual(h.precipitation)
    expect(h.windGustsRisk).toBeGreaterThanOrEqual(h.windGusts)
    expect(h.windGustsHigh).toBeGreaterThanOrEqual(h.windGustsRisk)
    expect(h.apparentTemperatureRisk).toBeLessThanOrEqual(h.apparentTemperature)
    expect(h.precipitationProbability).toBeGreaterThanOrEqual(0)
    expect(h.precipitationProbability).toBeLessThanOrEqual(100)

    // Skórování hodinu z živých dat unese.
    const s = scoreHour(h, KRKONOSE[2])
    expect(s.score).toBeGreaterThanOrEqual(0)
    expect(s.score).toBeLessThanOrEqual(100)

    // Oblačnost po vrstvách a UV musí dorazit — bez nich nejde východ a západ.
    expect(h.cloudLow + h.cloudMid + h.cloudHigh).toBeGreaterThanOrEqual(0)
    expect(Number.isFinite(h.uvIndex)).toBe(true)

    // Teplotní profil: sedm hladin, odspodu nahoru, s rozumnými výškami.
    expect(h.levels.length).toBeGreaterThanOrEqual(5)
    for (let k = 1; k < h.levels.length; k++) {
      expect(h.levels[k].height).toBeGreaterThan(h.levels[k - 1].height)
    }
    expect(h.levels[0].height).toBeLessThan(600)
    expect(h.levels.at(-1)!.height).toBeGreaterThan(1500)
    // Inverze buď je, nebo není — obojí je platná odpověď, ale ne nesmysl.
    const inverze = inversionIn(h.levels)
    if (inverze) {
      expect(inverze.topM).toBeGreaterThan(inverze.baseM)
      expect(inverze.strengthK).toBeGreaterThan(0)
    }
    console.log(
      `profil na Sněžce: ${h.levels.map((l) => `${Math.round(l.height)}m ${l.temperature.toFixed(1)}°`).join(' · ')}` +
        ` → ${inverze ? `inverze do ${inverze.topM} m` : 'bez inverze'}`,
    )

    // Zákal dorazí na pár dní dopředu, dál ne — a to se nesmí tvářit jako nula.
    const sAerosolem = snezka.hours.filter((x) => x.aerosol !== null)
    expect(sAerosolem.length).toBeGreaterThan(24)
    const z = haze(sAerosolem[0])!
    expect(z.rangeKm).toBeGreaterThan(8)
    console.log(`zákal: ${sAerosolem[0].aerosol} → ${z.rangeKm} km, ${z.label}`)
  })

  it('rozptyl ansámblu roste s předstihem, ne naopak', { timeout: 40000 }, async () => {
    const f = await fetchForecast([KRKONOSE[2]], 7)
    if (f.ensembles.length === 0) {
      console.warn('ansámbl nedorazil (minutový limit API), test přeskočen')
      return
    }
    const p = f.points[0]
    const now = p.hours.findIndex((h) => new Date(h.time) >= new Date())

    const meanWidth = (from: number, to: number) => {
      const xs = p.spread
        .slice(from, to)
        .filter((s) => s.members > 0)
        .map((s) => s.temperature)
      return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
    }
    const zitra = meanWidth(now, now + 24)
    const zaTyden = meanWidth(now + 120, now + 168)

    // Tohle je celý důvod, proč se opustilo porovnávání různě jemných modelů:
    // tam „shoda" s předstihem rostla, protože jemné modely prostě přestaly
    // vracet data a zbyly dva globály blízko sebe.
    console.log(`šířka p10—p90 teploty: zítra ${zitra.toFixed(1)} °C, za týden ${zaTyden.toFixed(1)} °C`)
    expect(zaTyden).toBeGreaterThan(zitra)
  })
})
