import { describe, expect, it } from 'vitest'
import { compassPoint, haversine, sunAzimuths } from '../geo'
import { formatDuration, legsOf, planRoute, toblerSpeed } from '../pace'
import { scoreHour, scoreRoute, verdictOf } from '../score'
import { scoreSky } from '../sky'
import { suggestGear } from '../gear'
import type { HourPoint, Route, Waypoint } from '../types'

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
  precipitation: 0,
  precipitationProbability: 0,
  windSpeed: 8,
  windGusts: 14,
  cape: 0,
  cloudCover: 20,
  cloudLow: 5,
  cloudMid: 10,
  cloudHigh: 30,
  visibility: 24000,
  freezingLevel: 3200,
  snowDepth: 0,
  humidity: 55,
  uvIndex: 3,
}
const hour = (patch: Partial<HourPoint>): HourPoint => ({ ...calm, ...patch })

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
