import { describe, expect, it } from 'vitest'
import { fogSeaAt, haze, inversionIn } from '../inversion'
import type { HourPoint } from '../types'

/** Hodina s daným profilem; zbytek je klidné počasí. */
const hour = (patch: Partial<HourPoint>): HourPoint =>
  ({
    time: '2026-11-08T07:00',
    temperature: 4,
    apparentTemperature: 2,
    apparentTemperatureRisk: 2,
    precipitation: 0,
    precipitationRisk: 0,
    precipitationProbability: 0,
    snowfall: 0,
    snowfallRisk: 0,
    windSpeed: 5,
    windGusts: 10,
    windGustsRisk: 10,
    windGustsHigh: 12,
    cape: 0,
    capeRisk: 0,
    cloudCover: 60,
    cloudLow: 80,
    cloudMid: 0,
    cloudHigh: 10,
    visibility: 20000,
    freezingLevel: 2500,
    snowDepth: 0,
    humidity: 92,
    uvIndex: 1,
    levels: [],
    aerosol: 0.1,
    members: 60,
    ...patch,
  }) as HourPoint

/** Podzimní inverze: v údolí zima, nad ní o pět stupňů tepleji. */
const INVERZE = [
  { height: 200, temperature: 1 },
  { height: 600, temperature: 4 },
  { height: 950, temperature: 6 },
  { height: 1500, temperature: 2 },
  { height: 2000, temperature: -1.5 },
]
const NORMAL = [
  { height: 200, temperature: 16 },
  { height: 900, temperature: 11.5 },
  { height: 1500, temperature: 7.5 },
]

describe('inverze v profilu', () => {
  it('normální profil žádnou nemá', () => {
    expect(inversionIn(NORMAL)).toBeNull()
  })

  it('najde vrstvu i její horní hranu', () => {
    const i = inversionIn(INVERZE)!
    expect(i).not.toBeNull()
    expect(i.baseM).toBe(200)
    expect(i.topM).toBe(950)
    expect(i.strengthK).toBeCloseTo(5, 1)
  })

  it('prázdný profil nespadne', () => {
    expect(inversionIn([])).toBeNull()
  })
})

describe('moře mlhy', () => {
  it('nad hladinou a za bezvětří je šance vysoká', () => {
    const f = fogSeaAt(hour({ levels: INVERZE }), 1603)!
    expect(f).not.toBeNull()
    expect(f.above).toBe(true)
    expect(f.chance).toBeGreaterThan(55)
    expect(f.topM).toBe(950)
    expect(f.reason).toContain('950')
  })

  it('pod hladinou je to jen mlha, ne fotka', () => {
    const f = fogSeaAt(hour({ levels: INVERZE }), 700)!
    expect(f.above).toBe(false)
    expect(f.reason).toContain('nad tebou')
  })

  it('vítr inverzi rozfouká a appka to řekne', () => {
    const klid = fogSeaAt(hour({ levels: INVERZE }), 1603)!
    const vitr = fogSeaAt(hour({ levels: INVERZE, windGusts: 45 }), 1603)!
    expect(vitr.chance).toBeLessThan(klid.chance)
    expect(vitr.reason).toContain('rozfouk')
  })

  it('bez vlhkosti a bez nízké oblačnosti se mlha nevyrobí', () => {
    const sucho = fogSeaAt(hour({ levels: INVERZE, cloudLow: 0, humidity: 55 }), 1603)!
    expect(sucho.chance).toBeLessThan(35)
  })

  it('bez inverze se nehlásí nic', () => {
    expect(fogSeaAt(hour({ levels: NORMAL }), 1603)).toBeNull()
  })
})

describe('zákal', () => {
  it('čistý vzduch znamená daleký výhled', () => {
    const cisto = haze(hour({ aerosol: 0.05 }))!
    const zakal = haze(hour({ aerosol: 0.5 }))!
    expect(cisto.rangeKm).toBeGreaterThan(zakal.rangeKm * 2)
    expect(cisto.label).toContain('průzračno')
    expect(zakal.label).toContain('zákal')
  })

  it('bez dat mlčí', () => {
    expect(haze(hour({ aerosol: null }))).toBeNull()
  })
})
