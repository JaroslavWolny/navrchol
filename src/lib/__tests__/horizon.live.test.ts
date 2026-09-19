import { describe, expect, it } from 'vitest'
import { destination, fetchHorizon, terrainSun } from '../horizon'
import { dayLight } from '../sun'

const SNEZKA = { lat: 50.7361, lon: 15.7397, elevation: 1603 }
const PEC = { lat: 50.6903, lon: 15.7322, elevation: 769 }
const RANO = [70, 80, 90, 100, 110]
const VECER = [250, 260, 270, 280, 290]

describe('geometrie', () => {
  it('bod v daném azimutu a vzdálenosti sedí', () => {
    const sever = destination(SNEZKA, 0, 10)
    expect(sever.lat).toBeGreaterThan(SNEZKA.lat)
    expect(Math.abs(sever.lon - SNEZKA.lon)).toBeLessThan(0.01)

    const vychod = destination(SNEZKA, 90, 10)
    expect(vychod.lon).toBeGreaterThan(SNEZKA.lon)
    expect(Math.abs(vychod.lat - SNEZKA.lat)).toBeLessThan(0.01)
  })
})

describe('živý obzor', () => {
  it('z vrcholu je obzor nízko, z údolí vysoko', { timeout: 40000 }, async () => {
    const [vrchol, udoli] = await Promise.all([
      fetchHorizon(SNEZKA, RANO),
      fetchHorizon(PEC, RANO),
    ])
    if (!vrchol || !udoli) {
      console.warn('Elevation API nedostupné, test přeskočen')
      return
    }

    const prumer = (h: NonNullable<typeof vrchol>) =>
      h.points.reduce((s, p) => s + p.angle, 0) / h.points.length

    console.log(
      `obzor na východ: Sněžka ${prumer(vrchol).toFixed(1)}°, Pec ${prumer(udoli).toFixed(1)}°`,
    )
    expect(prumer(vrchol)).toBeLessThan(prumer(udoli) - 2)
    expect(prumer(udoli)).toBeGreaterThan(1)
  })

  it('v údolí slunce vyjde znatelně později než v tabulce', { timeout: 40000 }, async () => {
    const den = new Date('2026-09-22T00:00:00')
    const flat = dayLight(PEC.lat, PEC.lon, den)
    const horizon = await fetchHorizon(PEC, [...RANO, ...VECER])
    if (!horizon) {
      console.warn('Elevation API nedostupné, test přeskočen')
      return
    }

    const t = terrainSun(PEC, den, horizon, flat)
    expect(t.sunrise).not.toBeNull()
    console.log(
      `Pec 22. 9.: tabulkový východ ${flat.sunrise!.getHours()}:${String(flat.sunrise!.getMinutes()).padStart(2, '0')}, ` +
        `za hřebenem o ${t.sunrise!.delayMin} min později, drží to ${t.sunrise!.blocker?.elevation} m ve ${t.sunrise!.blocker?.distanceKm} km`,
    )
    expect(t.sunrise!.delayMin).toBeGreaterThan(10)
    expect(t.sunrise!.at.getTime()).toBeGreaterThan(flat.sunrise!.getTime())
    expect(t.sunset!.delayMin).toBeGreaterThan(0)
    expect(t.blocked).toBe(false)
  })

  it('v zimě do sevřeného údolí slunce nevleze vůbec', { timeout: 40000 }, async () => {
    const den = new Date('2026-12-21T00:00:00')
    const flat = dayLight(PEC.lat, PEC.lon, den)
    const horizon = await fetchHorizon(PEC, [...RANO, ...VECER])
    if (!horizon) return

    // Slunce vyleze nejvýš k šestnácti stupňům, okolní svahy jsou přes dvacet.
    // Není to chyba výpočtu — je to důvod, proč se na východ leze jinam.
    const t = terrainSun(PEC, den, horizon, flat)
    expect(t.blocked).toBe(true)
    expect(t.sunrise).toBeNull()
  })

  it('na vrcholu se časy skoro neliší', { timeout: 40000 }, async () => {
    const den = new Date('2026-09-22T00:00:00')
    const flat = dayLight(SNEZKA.lat, SNEZKA.lon, den)
    const horizon = await fetchHorizon(SNEZKA, [...RANO, ...VECER])
    if (!horizon) return

    const t = terrainSun(SNEZKA, den, horizon, flat)
    expect(t.sunrise).not.toBeNull()
    console.log(`Sněžka: zdržení východu ${t.sunrise!.delayMin} min, západu ${t.sunset!.delayMin} min`)
    expect(Math.abs(t.sunrise!.delayMin)).toBeLessThan(12)
  })
})
