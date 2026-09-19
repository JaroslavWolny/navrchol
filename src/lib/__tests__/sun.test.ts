import { describe, expect, it } from 'vitest'
import {
  crossings,
  dayLight,
  milkyWayCore,
  moonIllumination,
  moonInfo,
  moonPosition,
  sunPosition,
} from '../sun'

const SNEZKA = { lat: 50.7361, lon: 15.7397 }

describe('poloha Slunce', () => {
  it('v pravé poledne stojí na jihu a nejvýš za den', () => {
    const den = new Date('2026-09-20T00:00:00')
    let best = { altitude: -90, azimuth: 0, at: den }
    for (let i = 0; i < 24 * 12; i++) {
      const at = new Date(den.getTime() + i * 5 * 60_000)
      const p = sunPosition(SNEZKA.lat, SNEZKA.lon, at)
      if (p.altitude > best.altitude) best = { ...p, at }
    }
    expect(Math.abs(best.azimuth - 180)).toBeLessThan(3)
    // O rovnodennosti je výška v poledne zhruba 90° minus zeměpisná šířka.
    expect(Math.abs(best.altitude - (90 - SNEZKA.lat))).toBeLessThan(2)
  })

  it('vychází na východě a zapadá na západě', () => {
    const den = new Date('2026-09-22T00:00:00')
    const { rise, set } = crossings(den, (at) => sunPosition(SNEZKA.lat, SNEZKA.lon, at), -0.833)
    expect(rise).not.toBeNull()
    expect(set).not.toBeNull()
    const vychod = sunPosition(SNEZKA.lat, SNEZKA.lon, rise!)
    const zapad = sunPosition(SNEZKA.lat, SNEZKA.lon, set!)
    expect(Math.abs(vychod.azimuth - 90)).toBeLessThan(4)
    expect(Math.abs(zapad.azimuth - 270)).toBeLessThan(4)
  })

  it('v létě je den delší než v zimě', () => {
    const leto = dayLight(SNEZKA.lat, SNEZKA.lon, new Date('2026-06-21T00:00:00'))
    const zima = dayLight(SNEZKA.lat, SNEZKA.lon, new Date('2026-12-21T00:00:00'))
    const delka = (d: ReturnType<typeof dayLight>) =>
      (d.sunset!.getTime() - d.sunrise!.getTime()) / 3_600_000
    expect(delka(leto)).toBeGreaterThan(15.5)
    expect(delka(zima)).toBeLessThan(8.5)
  })
})

describe('světelná okna', () => {
  const d = dayLight(SNEZKA.lat, SNEZKA.lon, new Date('2026-09-20T00:00:00'))

  it('jdou po sobě ve správném pořadí', () => {
    const casy = [
      d.blueMorning!.from,
      d.blueMorning!.to,
      d.goldenMorning!.to,
      d.goldenEvening!.from,
      d.goldenEvening!.to,
      d.blueEvening!.to,
    ].map((x) => x.getTime())
    for (let i = 1; i < casy.length; i++) expect(casy[i]).toBeGreaterThan(casy[i - 1])
  })

  it('modrá hodina končí východem a zlatá jím začíná', () => {
    expect(d.blueMorning!.to.getTime()).toBe(d.sunrise!.getTime())
    expect(d.goldenMorning!.from.getTime()).toBe(d.sunrise!.getTime())
    expect(d.goldenEvening!.to.getTime()).toBe(d.sunset!.getTime())
  })

  it('zlaté světlo netrvá hodinu a v zimě je delší než v létě', () => {
    const delka = (day: string) => {
      const x = dayLight(SNEZKA.lat, SNEZKA.lon, new Date(day))
      return (x.goldenEvening!.to.getTime() - x.goldenEvening!.from.getTime()) / 60_000
    }
    const leto = delka('2026-06-21T00:00:00')
    const zima = delka('2026-12-21T00:00:00')
    // V prosinci vyleze slunce nejvýš k šestnácti stupňům, takže prvních šest
    // stoupá pomalu. V červnu se přes ně přehoupne cestou vzhůru.
    expect(zima).toBeGreaterThan(leto)
    for (const d of [leto, zima]) {
      expect(d).toBeGreaterThan(35)
      expect(d).toBeLessThan(75)
    }
  })

  it('v září je v noci astronomická tma, v červnu na severu ne', () => {
    expect(d.night).not.toBeNull()
    const cerven = dayLight(SNEZKA.lat, SNEZKA.lon, new Date('2026-06-21T00:00:00'))
    expect(cerven.night).toBeNull()
  })
})

describe('Měsíc', () => {
  it('fáze se opakuje po synodickém měsíci', () => {
    const start = new Date('2026-01-01T12:00:00').getTime()
    const fractions: number[] = []
    for (let i = 0; i < 400; i++) {
      fractions.push(moonIllumination(new Date(start + i * 86_400_000)).fraction)
    }
    const novy: number[] = []
    for (let i = 1; i < fractions.length - 1; i++) {
      if (fractions[i] < fractions[i - 1] && fractions[i] < fractions[i + 1]) novy.push(i)
    }
    expect(novy.length).toBeGreaterThan(10)
    const rozestupy = novy.slice(1).map((x, i) => x - novy[i])
    const prumer = rozestupy.reduce((a, b) => a + b, 0) / rozestupy.length
    expect(Math.abs(prumer - 29.53)).toBeLessThan(0.6)
  })

  it('vychází každý den o kus později', () => {
    const minuty = [0, 1, 2, 3, 4]
      .map((i) => moonInfo(SNEZKA.lat, SNEZKA.lon, new Date(2026, 8, 20 + i)).rise)
      .filter((x): x is Date => x !== null)
      .map((t) => t.getHours() * 60 + t.getMinutes())

    expect(minuty.length).toBe(5)
    for (let i = 1; i < minuty.length; i++) {
      const delta = minuty[i] - minuty[i - 1]
      // Na podzim je posun malý (proto „měsíc žní"), ale vždycky kladný.
      expect(delta).toBeGreaterThan(0)
      expect(delta).toBeLessThan(90)
    }
  })

  it('některý den měsíc v kalendářním dni vůbec nezapadne', () => {
    // Zapadá až po půlnoci, takže do toho dne už se to nevejde — a appka na to
    // nesmí spadnout ani si čas vymyslet.
    const dny = [0, 1, 2, 3, 4, 5, 6].map((i) =>
      moonInfo(SNEZKA.lat, SNEZKA.lon, new Date(2026, 8, 19 + i)),
    )
    expect(dny.some((d) => d.set === null)).toBe(true)
    expect(dny.every((d) => d.rise !== null)).toBe(true)
  })

  it('úplněk je v noci nad obzorem, nov ne', () => {
    const start = new Date('2026-09-01T00:00:00').getTime()
    let uplnek = new Date(start)
    let max = 0
    for (let i = 0; i < 40; i++) {
      const den = new Date(start + i * 86_400_000)
      const f = moonIllumination(den).fraction
      if (f > max) {
        max = f
        uplnek = den
      }
    }
    // O úplňku stojí Měsíc kolem půlnoci vysoko — proto se v ten den nefotí hvězdy.
    const pulnoc = new Date(uplnek)
    pulnoc.setHours(0, 0, 0, 0)
    expect(moonPosition(SNEZKA.lat, SNEZKA.lon, pulnoc).altitude).toBeGreaterThan(10)
  })
})

describe('Mléčná dráha', () => {
  it('jádro se z Krkonoš sotva vyhoupne nad obzor', () => {
    const start = new Date('2026-07-15T00:00:00').getTime()
    let max = -90
    for (let i = 0; i < 24 * 6; i++) {
      max = Math.max(max, milkyWayCore(SNEZKA.lat, SNEZKA.lon, new Date(start + i * 600_000)).altitude)
    }
    // 90 − šířka − deklinace jádra (−29°) dává zhruba jedenáct stupňů.
    expect(max).toBeGreaterThan(8)
    expect(max).toBeLessThan(14)
  })
})
