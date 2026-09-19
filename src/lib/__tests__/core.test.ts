import { describe, expect, it } from 'vitest'
import { compassPoint, haversine, sunAzimuths } from '../geo'
import {
  exitMinutes,
  formatDuration,
  legsOf,
  planFromTrack,
  planRoute,
  snowFactor,
  snowProfileOf,
  toblerSpeed,
} from '../pace'
import { certaintyOf, scoreHour, scoreRoute, verdictOf } from '../score'
import { assess } from '../plan'
import { DEMO_ROUTE_ID, load } from '../../state/store'
import { scoreSky } from '../sky'
import { suggestGear } from '../gear'
import type { Forecast } from '../openMeteo'
import { withReturn } from '../routing'
import type { Track } from '../routing'
import type { HourPoint, Route, Spread, Waypoint } from '../types'

const PEC: Waypoint = { id: 'a', name: 'Pec pod Sněžkou', lat: 50.6903, lon: 15.7322, elevation: 769 }
const RUZOVA: Waypoint = { id: 'b', name: 'Růžová hora', lat: 50.7253, lon: 15.7397, elevation: 1390 }
const SNEZKA: Waypoint = { id: 'c', name: 'Sněžka', lat: 50.7361, lon: 15.7397, elevation: 1603 }

const route: Route = {
  id: 'r',
  name: 'Sněžka z Pece',
  waypoints: [PEC, RUZOVA, SNEZKA],
  startTime: '07:00',
  pace: 'stredni',
}

/** Klidná hodina bez jediného problému. */
const calm: HourPoint = {
  time: '2026-09-20T09:00',
  temperature: 12,
  apparentTemperature: 11,
  apparentTemperatureRisk: 11,
  precipitation: 0,
  precipitationRisk: 0,
  precipitationProbability: 0,
  snowfall: 0,
  snowfallRisk: 0,
  windSpeed: 8,
  windGusts: 14,
  windGustsRisk: 14,
  windGustsHigh: 14,
  cape: 0,
  capeRisk: 0,
  cloudCover: 20,
  cloudLow: 5,
  cloudMid: 10,
  cloudHigh: 30,
  visibility: 24000,
  freezingLevel: 3200,
  snowDepth: 0,
  humidity: 55,
  uvIndex: 3,
  // Normální profil: teplota klesá o 6,5 °C na kilometr, žádná inverze.
  levels: [
    { height: 200, temperature: 16 },
    { height: 800, temperature: 12 },
    { height: 1500, temperature: 7.5 },
    { height: 2000, temperature: 4 },
  ],
  aerosol: 0.12,
  members: 40,
}

/**
 * Hodina z klidného základu. Rizikové kvantily se dorovnají na ukazovanou hodnotu,
 * ať se v testech nemusí psát každá veličina dvakrát.
 */
const hour = (patch: Partial<HourPoint>): HourPoint => {
  const h = { ...calm, ...patch }
  return {
    ...h,
    apparentTemperatureRisk: patch.apparentTemperatureRisk ?? h.apparentTemperature,
    precipitationRisk: patch.precipitationRisk ?? h.precipitation,
    snowfallRisk: patch.snowfallRisk ?? h.snowfall,
    windGustsRisk: patch.windGustsRisk ?? h.windGusts,
    windGustsHigh: patch.windGustsHigh ?? h.windGusts,
    capeRisk: patch.capeRisk ?? h.cape,
  }
}

const noSpread: Spread = { temperature: 0, windGusts: 0, precipitation: 0, members: 40 }

describe('geo', () => {
  it('Pec–Sněžka je zhruba 5,2 km vzdušnou čarou', () => {
    expect(haversine(PEC, SNEZKA)).toBeGreaterThan(4.8)
    expect(haversine(PEC, SNEZKA)).toBeLessThan(5.6)
  })

  it('u rovnodennosti slunce vychází skoro přesně na východ', () => {
    const { sunrise, sunset } = sunAzimuths(50.74, new Date('2026-09-22T06:00:00Z'))
    expect(Math.abs(sunrise - 90)).toBeLessThan(3)
    expect(Math.abs(sunset - 270)).toBeLessThan(3)
  })

  it('azimut se překládá na světovou stranu', () => {
    expect(compassPoint(92)).toBe('V')
    expect(compassPoint(268)).toBe('Z')
    expect(compassPoint(1)).toBe('S')
  })
})

describe('tempo', () => {
  it('Toblerovo maximum je na mírném klesání, ne na rovině', () => {
    expect(toblerSpeed(-0.05)).toBeCloseTo(6, 5)
    expect(toblerSpeed(0)).toBeLessThan(toblerSpeed(-0.05))
  })

  it('do kopce se jde pomaleji než z kopce', () => {
    expect(toblerSpeed(0.25)).toBeLessThan(toblerSpeed(-0.1))
  })

  it('stoupání a klesání se počítá zvlášť', () => {
    const ls = legsOf(route)
    expect(ls).toHaveLength(2)
    expect(ls.reduce((s, l) => s + l.ascentM, 0)).toBe(834)
    expect(ls.reduce((s, l) => s + l.descentM, 0)).toBe(0)
  })

  it('časy průchodu jdou po sobě a startují v zadanou hodinu', () => {
    const plan = planRoute(route, new Date('2026-09-20T00:00:00'))
    expect(plan.arrivals).toHaveLength(3)
    expect(plan.arrivals[0].at.getHours()).toBe(7)
    expect(plan.arrivals[1].at.getTime()).toBeGreaterThan(plan.arrivals[0].at.getTime())
    expect(plan.arrivals[2].at.getTime()).toBeGreaterThan(plan.arrivals[1].at.getTime())
  })

  it('svižné tempo je rychlejší než pomalé', () => {
    const fast = planRoute({ ...route, pace: 'svizne' }, new Date('2026-09-20T00:00:00'))
    const slow = planRoute({ ...route, pace: 'pomale' }, new Date('2026-09-20T00:00:00'))
    expect(fast.minutes).toBeLessThan(slow.minutes)
  })

  it('délka se formátuje česky', () => {
    expect(formatDuration(260)).toBe('4 h 20 min')
    expect(formatDuration(45)).toBe('45 min')
  })
})

describe('skóre podmínek', () => {
  it('klidná hodina dostane plný počet', () => {
    expect(scoreHour(calm, SNEZKA).score).toBe(100)
  })

  it('nárazy 90 km/h na exponovaném vrcholu jsou tvrdý zákaz', () => {
    const r = scoreHour(hour({ windGusts: 90 }), SNEZKA)
    expect(r.issues.some((i) => i.severity === 'blok' && i.key === 'vitr')).toBe(true)
  })

  it('stejné nárazy nízko v údolí zákaz nejsou', () => {
    const r = scoreHour(hour({ windGusts: 90 }), PEC)
    expect(r.issues.some((i) => i.severity === 'blok')).toBe(false)
  })

  it('bouřka se srážkami je zákaz', () => {
    const r = scoreHour(hour({ cape: 1500, precipitation: 3 }), SNEZKA)
    expect(r.issues.some((i) => i.severity === 'blok' && i.key === 'bourka')).toBe(true)
  })

  it('déšť pod nulovou izotermou hlásí námrazu', () => {
    const r = scoreHour(hour({ freezingLevel: 900, precipitation: 1.5 }), SNEZKA)
    expect(r.issues.some((i) => i.key === 'namraza')).toBe(true)
  })

  it('jedno zablokované místo srazí celou trasu na nejdi', () => {
    const r = scoreRoute([
      { waypoint: PEC, hour: calm },
      { waypoint: RUZOVA, hour: calm },
      { waypoint: SNEZKA, hour: hour({ windGusts: 95 }) },
    ])
    expect(r.verdict).toBe('nejdi')
    expect(r.score).toBeLessThanOrEqual(25)
    expect(r.weakest?.waypoint.name).toBe('Sněžka')
  })

  it('nejhorší místo táhne skóre dolů víc než průměr', () => {
    const vsechnoDobre = scoreRoute([{ waypoint: PEC, hour: calm }, { waypoint: SNEZKA, hour: calm }])
    const jednoSpatne = scoreRoute([
      { waypoint: PEC, hour: calm },
      { waypoint: SNEZKA, hour: hour({ windGusts: 60, precipitation: 2 }) },
    ])
    expect(jednoSpatne.score).toBeLessThan(vsechnoDobre.score - 20)
  })

  it('stejný problém na víc bodech se hlásí jednou', () => {
    const windy = hour({ windGusts: 55 })
    const r = scoreRoute([
      { waypoint: RUZOVA, hour: windy },
      { waypoint: SNEZKA, hour: windy },
    ])
    expect(r.warnings.filter((w) => w.key === 'vitr')).toHaveLength(1)
  })

  it('rozpad skóre sedí na výsledné číslo', () => {
    const h = hour({ windGusts: 62, precipitation: 2.4, precipitationProbability: 70, apparentTemperature: -3 })
    const r = scoreHour(h, SNEZKA)
    const soucet = r.penalties.reduce((s, p) => s + p.points, 0)
    // Penalizace se smí přehnat přes sto (liják nemá strop), skóre se drží v nule.
    expect(Math.max(0, Math.round(100 - soucet))).toBe(r.score)

    const mirne = scoreHour(hour({ windGusts: 55, precipitation: 0.5 }), SNEZKA)
    const mirneSoucet = mirne.penalties.reduce((s, p) => s + p.points, 0)
    expect(Math.round(100 - mirneSoucet)).toBe(mirne.score)
  })

  it('rozpad je seřazený od nejhoršího a nese důvod', () => {
    const r = scoreHour(hour({ windGusts: 68, precipitation: 0.3 }), SNEZKA)
    expect(r.penalties[0].label).toBe('Vítr')
    expect(r.penalties[0].detail).toContain('exponované místo')
    for (let i = 1; i < r.penalties.length; i++) {
      expect(r.penalties[i - 1].points).toBeGreaterThanOrEqual(r.penalties[i].points)
    }
  })

  it('za bezvadných podmínek nemá co vypsat', () => {
    expect(scoreHour(calm, SNEZKA).penalties).toHaveLength(0)
  })

  it('stejný vítr sebere víc bodů nahoře než v údolí', () => {
    const windy = hour({ windGusts: 60 })
    const nahore = scoreHour(windy, SNEZKA).penalties.find((p) => p.key === 'vitr')!
    const dole = scoreHour(windy, PEC).penalties.find((p) => p.key === 'vitr')!
    expect(nahore.points).toBeGreaterThan(dole.points)
  })

  it('nejslabší místo trasy si nese vlastní rozpad', () => {
    const r = scoreRoute([
      { waypoint: PEC, hour: calm },
      { waypoint: SNEZKA, hour: hour({ windGusts: 66 }) },
    ])
    expect(r.weakest?.waypoint.name).toBe('Sněžka')
    expect(r.weakest?.penalties.some((p) => p.key === 'vitr')).toBe(true)
  })

  it('prahy verdiktu', () => {
    expect(verdictOf(84)).toBe('jdi')
    expect(verdictOf(50)).toBe('zvaz')
    expect(verdictOf(20)).toBe('nejdi')
  })
})

describe('barevnost oblohy', () => {
  it('vysoká oblačnost kolem poloviny a čistý obzor je nejlepší kombinace', () => {
    const r = scoreSky(hour({ cloudHigh: 45, cloudMid: 20, cloudLow: 3 }))
    expect(r.score).toBeGreaterThanOrEqual(75)
    expect(r.label).toBe('paráda')
  })

  it('úplně čistá obloha je fádní', () => {
    const r = scoreSky(hour({ cloudHigh: 0, cloudMid: 0, cloudLow: 0 }))
    expect(r.score).toBeLessThan(55)
    expect(r.reason).toContain('bez mráčku')
  })

  it('nízká oblačnost představení zruší', () => {
    const r = scoreSky(hour({ cloudHigh: 45, cloudMid: 30, cloudLow: 95 }))
    expect(r.score).toBeLessThan(30)
    expect(r.label).toBe('nic moc')
  })

  it('dvě vrstvy blízko ideálu nejsou zataženo, i když dají v součtu skoro sto', () => {
    const r = scoreSky(hour({ cloudHigh: 63, cloudMid: 34, cloudLow: 0 }))
    expect(r.score).toBeGreaterThanOrEqual(75)
    expect(r.reason).not.toContain('Zataženo')
  })

  it('zákal barvy vymyje', () => {
    const cisto = scoreSky(hour({ cloudHigh: 45, cloudMid: 20, cloudLow: 3, visibility: 30000 }))
    const zakal = scoreSky(hour({ cloudHigh: 45, cloudMid: 20, cloudLow: 3, visibility: 4000 }))
    expect(zakal.score).toBeLessThan(cisto.score)
  })
})

describe('výbava', () => {
  const base = {
    minApparent: 12,
    maxGusts: 15,
    totalPrecip: 0,
    maxPrecipProbability: 0,
    maxUv: 2,
    minVisibility: 20000,
    maxSnowDepth: 0,
    anyIcing: false,
    startsBeforeSunrise: false,
    endsAfterSunset: false,
    durationMin: 180,
    highestName: 'Sněžka',
    highestElevation: 1603,
  }

  it('za hezkého počasí nic nepřidává', () => {
    expect(suggestGear(base)).toHaveLength(0)
  })

  it('vítr si vyžádá větrovku a uvede proč', () => {
    const g = suggestGear({ ...base, maxGusts: 58 })
    expect(g[0].name).toBe('Větrovka')
    expect(g[0].why).toContain('58')
  })

  it('výstup před svítáním znamená čelovku', () => {
    const g = suggestGear({ ...base, startsBeforeSunrise: true })
    expect(g.some((i) => i.name.startsWith('Čelovka'))).toBe(true)
  })

  it('túra na celý den chce jídlo a vodu', () => {
    const g = suggestGear({ ...base, durationMin: 330 })
    expect(g.some((i) => i.name.includes('2,5 l vody'))).toBe(true)
  })
})


describe('kalibrace srážek', () => {
  const rain = (mm: number, probability = 100) =>
    scoreHour(hour({ precipitation: mm, precipitationProbability: probability }), SNEZKA).score

  it('mrholení pustí dál, trvalý déšť už ne', () => {
    expect(verdictOf(rain(0.3))).toBe('jdi')
    expect(verdictOf(rain(2))).toBe('zvaz')
    expect(verdictOf(rain(3))).toBe('zvaz')
  })

  it('liják není totéž co déšť — penalizace nemá strop', () => {
    expect(rain(8)).toBeLessThan(rain(4))
    expect(rain(15)).toBeLessThan(rain(8))
    expect(verdictOf(rain(8))).toBe('nejdi')
    expect(rain(15)).toBe(0)
  })

  it('skóruje se z nepříznivého kvartilu, ne z mediánu', () => {
    const median = scoreHour(hour({ precipitation: 0, precipitationRisk: 0 }), SNEZKA).score
    const risk = scoreHour(hour({ precipitation: 0, precipitationRisk: 3 }), SNEZKA).score
    expect(median).toBe(100)
    expect(risk).toBeLessThan(70)
  })

  it('vysoká šance na srážky sebere body i bez vody v kvantilu', () => {
    expect(rain(0, 90)).toBeLessThan(100)
    expect(rain(0, 0)).toBe(100)
  })
})

describe('podchlazení a promočení', () => {
  it('mokro, chlad a vítr dohromady jsou tvrdý zákaz', () => {
    const r = scoreHour(
      hour({ apparentTemperature: 3, precipitation: 1.5, precipitationProbability: 90, windGusts: 50 }),
      SNEZKA,
    )
    expect(r.issues.some((i) => i.severity === 'blok' && i.key === 'podchlazeni')).toBe(true)
  })

  it('každá ta věc zvlášť zákaz není', () => {
    const chlad = scoreHour(hour({ apparentTemperature: 3 }), SNEZKA)
    const vitr = scoreHour(hour({ windGusts: 50 }), SNEZKA)
    const dest = scoreHour(hour({ precipitation: 1.5 }), PEC)
    for (const r of [chlad, vitr, dest]) {
      expect(r.issues.some((i) => i.severity === 'blok')).toBe(false)
    }
  })

  it('kombinace sebere víc bodů než součet jejích částí', () => {
    const spolu = scoreHour(
      hour({ apparentTemperature: 8, precipitation: 2, windGusts: 45 }),
      SNEZKA,
    )
    const bezDeste = scoreHour(hour({ apparentTemperature: 8, windGusts: 45 }), SNEZKA)
    const bezVetru = scoreHour(hour({ apparentTemperature: 8, precipitation: 2 }), SNEZKA)
    const ztrata = (s: number) => 100 - s
    expect(ztrata(spolu.score)).toBeGreaterThan(ztrata(bezDeste.score) + ztrata(bezVetru.score) * 0.9)
    expect(spolu.penalties.some((p) => p.key === 'podchlazeni')).toBe(true)
  })

  it('promočení se kumuluje: pátá hodina v dešti bolí víc než první', () => {
    const wet = hour({ precipitation: 1.2, precipitationProbability: 95, apparentTemperature: 9 })
    const r = scoreRoute(Array.from({ length: 5 }, () => ({ waypoint: SNEZKA, hour: wet })))
    expect(r.weakest?.penalties.some((p) => p.key === 'mokro')).toBe(true)
    expect(r.rainMm).toBeCloseTo(6, 1)
    // Stejná hodina jednorázově musí vyjít lépe než jako pátá v řadě.
    expect(scoreHour(wet, SNEZKA).score).toBeGreaterThan(r.weakest!.score)
  })
})

describe('sníh', () => {
  it('sněžení se nepočítá jako promočení, ale jako sníh', () => {
    // 2 cm sněhu je 2,86 mm vody — po odečtení nezbyde na déšť nic.
    const r = scoreHour(
      hour({ precipitation: 2.9, snowfall: 2, precipitationProbability: 95, apparentTemperature: -2 }),
      SNEZKA,
    )
    expect(r.penalties.some((p) => p.key === 'snih')).toBe(true)
    expect(r.penalties.some((p) => p.key === 'srazky')).toBe(false)
  })

  it('metr sněhu na zemi sebere body i za bezvětří', () => {
    const r = scoreHour(hour({ snowDepth: 0.8 }), SNEZKA)
    expect(r.penalties.find((p) => p.key === 'snih')!.points).toBeGreaterThan(15)
  })

  it('prošlapávání zpomalí tempo', () => {
    expect(snowFactor(0.1)).toBe(1)
    expect(snowFactor(0.5)).toBeLessThan(0.6)

    const track = fakeTrack([PEC, RUZOVA, SNEZKA])
    const bez = planFromTrack(track, route, new Date('2026-09-20T00:00:00'))
    const snih = planFromTrack(
      track,
      route,
      new Date('2026-09-20T00:00:00'),
      snowProfileOf([
        { elevation: 769, depthM: 0 },
        { elevation: 1603, depthM: 0.6 },
      ]),
    )
    expect(snih.minutes).toBeGreaterThan(bez.minutes * 1.3)
  })

  it('sníh se interpoluje podle výšky, ne průměruje přes trasu', () => {
    const profil = snowProfileOf([
      { elevation: 700, depthM: 0 },
      { elevation: 1500, depthM: 0.8 },
    ])
    expect(profil(700)).toBe(0)
    expect(profil(1100)).toBeCloseTo(0.4, 2)
    expect(profil(2000)).toBe(0.8)
  })
})

describe('jistota z ansámblu', () => {
  it('široký rozptyl znamená menší jistotu', () => {
    const h = hour({ precipitation: 1, precipitationRisk: 3, windGusts: 40, windGustsRisk: 55 })
    const uzky = certaintyOf(h, { ...noSpread, precipitation: 0.2, windGusts: 5 }, SNEZKA)
    const siroky = certaintyOf(h, { ...noSpread, precipitation: 4, windGusts: 40 }, SNEZKA)
    expect(uzky).not.toBeNull()
    expect(siroky!).toBeLessThan(uzky!)
  })

  it('bez ansámblu se jistota nepředstírá', () => {
    expect(certaintyOf(calm, { ...noSpread, members: 0 }, SNEZKA)).toBeNull()
  })
})

describe('vzorkování po hodinách', () => {
  const DOLE: Waypoint = { id: 'd', name: 'Parkoviště', lat: 50.0, lon: 15.0, elevation: 600 }
  const NAHORE: Waypoint = { id: 'n', name: 'Hřeben', lat: 50.1, lon: 15.2, elevation: 1400 }
  const dlouha: Route = {
    id: 'dl',
    name: 'Dlouhý výstup',
    waypoints: [DOLE, NAHORE],
    startTime: '07:00',
    pace: 'stredni',
  }

  it('bouřka mezi dvěma body trasy nesmí propadnout sítem', () => {
    const forecast = fakeForecast([DOLE, NAHORE], (i) =>
      i === 9 ? { precipitation: 20, precipitationProbability: 100 } : {},
    )
    const a = assess(dlouha, fakeTrack([DOLE, NAHORE]), forecast, new Date('2026-09-20T07:00:00'))

    // Přesně ta situace, kvůli které vzorkování existuje: v žádném bodě trasy
    // nejsi v devět, takže staré skórování po waypointech tu hodinu nevidělo.
    expect(a.passes.some((p) => p.hour.time === '2026-09-20T09:00')).toBe(false)
    expect(a.samples.some((s) => s.hour.time === '2026-09-20T09:00')).toBe(true)

    const jenBody = scoreRoute(a.passes.map((p) => ({ waypoint: p.waypoint, hour: p.hour })))
    expect(jenBody.verdict).toBe('jdi')
    expect(a.score.verdict).toBe('nejdi')
  })

  it('vzorky pokryjí celou túru bez děr', () => {
    const forecast = fakeForecast([DOLE, NAHORE])
    const a = assess(dlouha, fakeTrack([DOLE, NAHORE]), forecast, new Date('2026-09-20T07:00:00'))
    const end = a.plan.arrivals.at(-1)!.at

    expect(a.samples[0].at.getTime()).toBe(new Date('2026-09-20T07:00:00').getTime())
    expect(a.samples.at(-1)!.at.getTime()).toBe(end.getTime())
    for (let i = 1; i < a.samples.length; i++) {
      const dt = a.samples[i].at.getTime() - a.samples[i - 1].at.getTime()
      expect(dt).toBeGreaterThan(0)
      expect(dt).toBeLessThanOrEqual(3_600_000)
    }
  })

  it('hodina mezi body se pojmenuje úsekem, ne nejbližším bodem', () => {
    const forecast = fakeForecast([DOLE, NAHORE], (i) => (i === 9 ? { windGusts: 60 } : {}))
    const a = assess(dlouha, fakeTrack([DOLE, NAHORE]), forecast, new Date('2026-09-20T07:00:00'))
    const mezi = a.samples.find((s) => s.hour.time === '2026-09-20T09:00')!
    expect(mezi.where.name).toBe('Parkoviště → Hřeben')
    // Výška je ze skutečné trati, takže se pozná hřeben i mezi body.
    expect(mezi.where.elevation).toBeGreaterThan(600)
    expect(mezi.where.elevation).toBeLessThan(1400)
  })

  it('rezerva do tmy a bouřkový obrat se spočítají', () => {
    const forecast = fakeForecast([DOLE, NAHORE], (i) =>
      i >= 13 ? { cape: 900, precipitationProbability: 60 } : {},
    )
    const a = assess(dlouha, fakeTrack([DOLE, NAHORE]), forecast, new Date('2026-09-20T07:00:00'))

    expect(a.daylightReserveMin).not.toBeNull()
    expect(a.daylightReserveMin!).toBeGreaterThan(0)
    expect(a.storm).not.toBeNull()
    expect(a.storm!.from.getHours()).toBe(13)
    // Obrat musí být dřív než bouřka, a to přesně o dobu sestupu pod hranici lesa.
    expect(a.storm!.turnaround.getTime()).toBeLessThan(a.storm!.from.getTime())
    expect(a.storm!.exitMin).toBeGreaterThan(0)
    expect(a.storm!.latestStart.getTime()).toBeLessThan(a.storm!.turnaround.getTime())
  })

  it('co spadlo před startem se sečte za 24 a 48 hodin', () => {
    // Předpověď začíná dva dny před túrou, takže hodiny před startem jsou v řadě.
    // Prší celý první den, pak nic: do 24 h před startem spadne 17 hodin dešťů.
    const forecast = fakeForecast([DOLE, NAHORE], (_i, _w, day) =>
      day === 0 ? { precipitation: 0.5 } : {},
    )
    const a = assess(dlouha, fakeTrack([DOLE, NAHORE]), forecast, new Date('2026-09-20T07:00:00'))
    expect(a.wetGround.mm24).toBeCloseTo(8.5, 1)
    expect(a.wetGround.mm48).toBeCloseTo(12, 1)
  })
})

describe('sestup z hřebene', () => {
  it('bere kratší z obou směrů a nulu, když už jsi dole', () => {
    const points = [
      { lat: 50.0, lon: 15.0, elevation: 800 },
      { lat: 50.01, lon: 15.0, elevation: 1300 },
      { lat: 50.02, lon: 15.0, elevation: 1500 },
      { lat: 50.05, lon: 15.0, elevation: 1450 },
      { lat: 50.06, lon: 15.0, elevation: 900 },
    ]
    const track: Track = {
      points,
      lengthKm: 0,
      ascentM: 0,
      descentM: 0,
      waypointIndices: [0, 2, 4],
      fallback: true,
    }
    const dopredu = exitMinutes(track, 3, 1200, 'stredni')
    const dozadu = exitMinutes(track, 1, 1200, 'stredni')
    expect(exitMinutes(track, 0, 1200, 'stredni')).toBe(0)
    expect(dopredu).toBeGreaterThan(0)
    expect(dozadu).toBeGreaterThan(0)
    // Z bodu 1 je blíž dolů zpátky na začátek než dopředu přes vrchol.
    expect(dozadu).toBeLessThan(dopredu)
  })
})

/**
 * Předpověď z ruky: čtyři dny po hodinách od půlnoci, stejná ve všech bodech,
 * dokud si patch neřekne o jinou hodinu. Index hodiny je hodina v rámci dne.
 */
function fakeForecast(
  waypoints: Waypoint[],
  patchAt: (hourOfDay: number, w: Waypoint, dayIndex: number) => Partial<HourPoint> = () => ({}),
): Forecast {
  const days = ['2026-09-19', '2026-09-20', '2026-09-21']
  const points = waypoints.map((w) => {
    const hours: HourPoint[] = []
    const spread: Spread[] = []
    for (let d = 0; d < days.length; d++) {
      for (let i = 0; i < 24; i++) {
        hours.push(hour({ time: `${days[d]}T${String(i).padStart(2, '0')}:00`, ...patchAt(i, w, d) }))
        spread.push(noSpread)
      }
    }
    return { waypointId: w.id, hours, spread }
  })
  return {
    points,
    days: days.map((date) => ({ date, sunrise: `${date}T06:30`, sunset: `${date}T19:00` })),
    fetchedAt: new Date(),
    ensembles: ['icon_d2_eps'],
  }
}

/** Trať jako lomená čára přes body trasy, s body mezi nimi. */
function fakeTrack(waypoints: Waypoint[]): Track {
  const points: Array<{ lat: number; lon: number; elevation: number }> = []
  const waypointIndices: number[] = []
  const STEPS = 20
  waypoints.forEach((w, i) => {
    waypointIndices.push(points.length)
    points.push({ lat: w.lat, lon: w.lon, elevation: w.elevation })
    const next = waypoints[i + 1]
    if (!next) return
    for (let s = 1; s < STEPS; s++) {
      const t = s / STEPS
      points.push({
        lat: w.lat + (next.lat - w.lat) * t,
        lon: w.lon + (next.lon - w.lon) * t,
        elevation: w.elevation + (next.elevation - w.elevation) * t,
      })
    }
  })
  return { points, lengthKm: 0, ascentM: 0, descentM: 0, waypointIndices, fallback: true }
}

describe('tam a zpět', () => {
  const DOLE: Waypoint = { id: 'd', name: 'Parkoviště', lat: 50.0, lon: 15.0, elevation: 600 }
  const NAHORE: Waypoint = { id: 'n', name: 'Hřeben', lat: 50.1, lon: 15.2, elevation: 1400 }
  const tam: Route = {
    id: 'tz',
    name: 'Výstup',
    waypoints: [DOLE, NAHORE],
    startTime: '07:00',
    pace: 'stredni',
  }
  const zpet: Route = { ...tam, roundTrip: true }

  it('trať se zrcadlí a body zůstanou na správných místech', () => {
    const jednosmerna = fakeTrack([DOLE, NAHORE])
    const obousmerna = withReturn(jednosmerna)

    expect(obousmerna.points).toHaveLength(jednosmerna.points.length * 2 - 1)
    expect(obousmerna.lengthKm).toBeCloseTo(jednosmerna.lengthKm * 2, 6)
    // Co se vystoupá, to se i sejde.
    expect(obousmerna.ascentM).toBe(jednosmerna.ascentM + jednosmerna.descentM)
    expect(obousmerna.descentM).toBe(obousmerna.ascentM)

    // Obrátka je jeden bod, ne dva: dva body tam → tři průchody celkem.
    expect(obousmerna.waypointIndices).toHaveLength(3)
    const [start, vrchol, navrat] = obousmerna.waypointIndices
    expect(start).toBe(0)
    expect(obousmerna.points[vrchol].elevation).toBe(1400)
    expect(obousmerna.points[navrat].elevation).toBe(600)
    expect(navrat).toBe(obousmerna.points.length - 1)
  })

  it('cesta zpátky se započítá do času i do bodů průchodu', () => {
    const forecast = fakeForecast([DOLE, NAHORE])
    const a = assess(tam, fakeTrack([DOLE, NAHORE]), forecast, new Date('2026-09-20T07:00:00'))
    const b = assess(zpet, withReturn(fakeTrack([DOLE, NAHORE])), forecast, new Date('2026-09-20T07:00:00'))

    expect(a.passes).toHaveLength(2)
    expect(b.passes).toHaveLength(3)
    // Sestup je rychlejší než výstup, takže návrat čas nezdvojnásobí, ale musí
    // ho výrazně prodloužit — a rezerva do tmy o stejný kus spadnout.
    expect(b.plan.minutes).toBeGreaterThan(a.plan.minutes * 1.5)
    expect(b.daylightReserveMin!).toBeLessThan(a.daylightReserveMin! - 60)
    expect(b.samples.length).toBeGreaterThan(a.samples.length)
  })

  it('odpolední bouřka na sestupu se do verdiktu dostane až s návratem', () => {
    // Nahoře jsi kolem desáté, dole zpátky odpoledne. Bouřka ve 13:00 potká
    // jen toho, kdo počítá i cestu zpátky.
    const forecast = fakeForecast([DOLE, NAHORE], (i) =>
      i === 13 ? { cape: 1500, precipitation: 3, precipitationProbability: 90 } : {},
    )
    const track = fakeTrack([DOLE, NAHORE])
    const jenTam = assess(tam, track, forecast, new Date('2026-09-20T07:00:00'))
    const iZpet = assess(zpet, withReturn(track), forecast, new Date('2026-09-20T07:00:00'))

    expect(jenTam.samples.some((s) => s.hour.time === '2026-09-20T13:00')).toBe(false)
    expect(iZpet.samples.some((s) => s.hour.time === '2026-09-20T13:00')).toBe(true)
    expect(jenTam.score.blockers).toHaveLength(0)
    expect(iZpet.score.blockers.some((b) => b.key === 'bourka')).toBe(true)
  })
})

describe('uložená data', () => {
  // Testy běží v Node, kde localStorage není. Stačí ale to, co store používá.
  const pamet: Record<string, string> = {}
  globalThis.localStorage = {
    getItem: (k: string) => pamet[k] ?? null,
    setItem: (k: string, v: string) => {
      pamet[k] = v
    },
    removeItem: (k: string) => delete pamet[k],
    clear: () => Object.keys(pamet).forEach((k) => delete pamet[k]),
    key: () => null,
    length: 0,
  } as Storage

  it('ukázková trasa se překlopí na tam a zpět, vlastní zůstanou', () => {
    const stara: Route = { ...route, id: DEMO_ROUTE_ID, roundTrip: undefined }
    const vlastni: Route = { ...route, id: 'moje', roundTrip: undefined }
    const rucne: Route = { ...route, id: DEMO_ROUTE_ID, roundTrip: false }

    localStorage.setItem(
      'navrchol.v1',
      JSON.stringify({ routes: [stara, vlastni, rucne], activeRouteId: DEMO_ROUTE_ID }),
    )
    const [a, b, c] = load().routes
    expect(a.roundTrip).toBe(true)
    expect(b.roundTrip).toBeUndefined()
    // Kdo si ukázku vědomě přepnul na jednosměrnou, tomu to appka nepřepíše.
    expect(c.roundTrip).toBe(false)
    localStorage.clear()
  })
})
