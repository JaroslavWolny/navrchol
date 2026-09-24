import { describe, expect, it } from 'vitest'
import { climb, cumulativeKm, smoothElevations } from '../geo'
import { forecastSites, siteIndexByPoint, MAX_SITES } from '../sites'
import { importGpx, parseGpx, thin } from '../gpx'
import { freeWindAt, type RawLocation } from '../openMeteo'
import { calibrate, planFromTrack } from '../pace'
import { assess } from '../plan'
import { waypointIndicesOf, withReturn, type Track } from '../routing'
import type { Forecast } from '../openMeteo'
import type { HourPoint, Route, TrackPoint, Waypoint } from '../types'

/** Trať po přímce mezi body s daným výškovým profilem, bod každých ~50 m. */
function line(from: [number, number], to: [number, number], profile: (t: number) => number, n = 200): TrackPoint[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n
    return { lat: from[0] + (to[0] - from[0]) * t, lon: from[1] + (to[1] - from[1]) * t, elevation: profile(t) }
  })
}

describe('stoupání s hysterezí', () => {
  it('šum pod pět metrů do stoupání nezapočítá', () => {
    const noisy = Array.from({ length: 400 }, (_, i) => 1000 + (i % 2 === 0 ? 2 : -2))
    expect(climb(noisy).ascent).toBe(0)
    // Prostý součet by z toho udělal stovky metrů.
    const naive = noisy.slice(1).reduce((s, e, i) => s + Math.max(0, e - noisy[i]), 0)
    expect(naive).toBeGreaterThan(700)
  })

  it('skutečný kopec započítá celý', () => {
    const hill = [...Array.from({ length: 50 }, (_, i) => 700 + i * 10), ...Array.from({ length: 50 }, (_, i) => 1190 - i * 10)]
    const c = climb(hill)
    expect(c.ascent).toBeGreaterThanOrEqual(485)
    expect(c.descent).toBeGreaterThanOrEqual(485)
  })

  it('vyhlazení srazí šum z hodinek, ale nechá tvar kopce', () => {
    const raw = line([50, 15], [50.02, 15], (t) => 800 + 300 * t).map((p, i) => ({
      ...p,
      elevation: p.elevation + (i % 2 === 0 ? 6 : -6),
    }))
    const smooth = smoothElevations(raw)
    expect(climb(raw.map((p) => p.elevation), 0).ascent).toBeGreaterThan(1000)
    expect(climb(smooth.map((p) => p.elevation), 0).ascent).toBeLessThan(400)
    expect(smooth[smooth.length - 1].elevation).toBeGreaterThan(1050)
  })
})

describe('místa předpovědi podél trati', () => {
  // Parkoviště → hřeben ve 1 450 m uprostřed → sedlo → cíl. Dva body trasy, hřeben mezi nimi.
  const ridge = line([50.0, 15.0], [50.09, 15.0], (t) => 700 + 750 * Math.sin(Math.PI * t))

  it('hřeben mezi dvěma body trasy dostane vlastní předpověď', () => {
    const sites = forecastSites(ridge)
    const top = Math.max(...sites.map((s) => s.elevation))
    expect(top).toBeGreaterThan(1440)
    expect(sites.some((s) => s.trackIndex === 0)).toBe(true)
    expect(sites.some((s) => s.trackIndex === ridge.length - 1)).toBe(true)
  })

  it('nevezme víc míst, než je limit, a jdou po trati v pořadí', () => {
    const long = line([50.0, 15.0], [50.4, 15.0], (t) => 600 + 400 * Math.sin(8 * Math.PI * t), 1500)
    const sites = forecastSites(long)
    expect(sites.length).toBeLessThanOrEqual(MAX_SITES)
    expect(sites.length).toBeGreaterThanOrEqual(5)
    for (let i = 1; i < sites.length; i++) expect(sites[i].trackIndex).toBeGreaterThan(sites[i - 1].trackIndex)
  })

  it('krátká rovná trasa nedostane zbytečně moc míst', () => {
    const flat = line([50.0, 15.0], [50.01, 15.0], () => 500, 40)
    expect(forecastSites(flat).length).toBeLessThanOrEqual(2)
  })

  it('cesta zpátky používá stejná místa jako cesta tam', () => {
    const sites = forecastSites(ridge)
    const n = ridge.length
    const back = [...ridge, ...ridge.slice(0, -1).reverse()]
    const map = siteIndexByPoint(back, sites, n - 1)
    for (const i of [10, 60, 120, 180]) expect(map[2 * (n - 1) - i]).toBe(map[i])
  })
})

describe('body trasy na okruhu', () => {
  it('cíl okruhu se najde na konci trati, ne na začátku', () => {
    const loop = [
      ...line([50.0, 15.0], [50.02, 15.02], () => 600, 50),
      ...line([50.02, 15.02], [50.0, 15.0], () => 600, 50).slice(1),
    ]
    const start: Waypoint = { id: 'a', name: 'Start', lat: 50.0, lon: 15.0, elevation: 600 }
    const turn: Waypoint = { id: 'b', name: 'Obrátka', lat: 50.02, lon: 15.02, elevation: 600 }
    const idx = waypointIndicesOf(loop, [start, turn, { ...start, id: 'c' }])
    expect(idx[0]).toBe(0)
    expect(idx[1]).toBe(50)
    expect(idx[2]).toBe(loop.length - 1)
  })
})

describe('GPX', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Mapy.cz">
  <metadata><name>Ignorované metadata</name></metadata>
  <wpt lat="50.7361" lon="15.7397"><name>Sněžka</name></wpt>
  <trk><name>Sněžka z Pece &amp; zpět</name><trkseg>
    <trkpt lat="50.6950" lon="15.7392"><ele>762</ele></trkpt>
    <trkpt lat='50.7104' lon='15.7499'><ele>1250.5</ele><time>2026-09-20T07:00:00Z</time></trkpt>
    <trkpt lon="15.7397" lat="50.7361"><ele>1601</ele></trkpt>
  </trkseg></trk>
</gpx>`

  it('přečte trať, výšky, jméno a pojmenované body', () => {
    const g = parseGpx(xml)
    expect(g.name).toBe('Sněžka z Pece & zpět')
    expect(g.points).toHaveLength(3)
    expect(g.points[1]).toEqual({ lat: 50.7104, lon: 15.7499, elevation: 1250.5 })
    // Pořadí atributů v GPX není dané.
    expect(g.points[2].lat).toBe(50.7361)
    expect(g.marks).toEqual([{ name: 'Sněžka', lat: 50.7361, lon: 15.7397 }])
  })

  it('bez trati vezme aspoň plánovanou cestu (rtept)', () => {
    const g = parseGpx('<gpx><rte><rtept lat="50" lon="15"/><rtept lat="50.1" lon="15.1"/></rte></gpx>')
    expect(g.points).toHaveLength(2)
    expect(g.points[0].elevation).toBeNull()
  })

  it('z GPX s výškami udělá trasu bez jediného dotazu na síť', async () => {
    const r = await importGpx(xml)
    expect(r.name).toBe('Sněžka z Pece & zpět')
    expect(r.waypoints.at(-1)!.name).toBe('Sněžka')
    expect(r.closed).toBe(false)
    expect(r.track.length).toBe(3)
  })

  it('okruh pozná podle toho, že cíl je u startu', async () => {
    const pts = [
      ...line([50.0, 15.0], [50.02, 15.02], (t) => 600 + 200 * t, 40),
      ...line([50.02, 15.02], [50.0, 15.0], (t) => 800 - 200 * t, 40).slice(1),
    ]
    const loopXml = `<gpx><trk><trkseg>${pts.map((p) => `<trkpt lat="${p.lat}" lon="${p.lon}"><ele>${p.elevation}</ele></trkpt>`).join('')}</trkseg></trk></gpx>`
    const r = await importGpx(loopXml)
    expect(r.closed).toBe(true)
    expect(r.waypoints).toHaveLength(3)
    expect(r.waypoints[1].name).toBe('Nejvyšší bod')
  })

  it('záznam z hodinek proředí', () => {
    const dense = line([50, 15], [50.01, 15], () => 500, 1000)
    const thinned = thin(dense, 0.02)
    expect(thinned.length).toBeLessThan(80)
    expect(thinned[0]).toBe(dense[0])
    expect(thinned.at(-1)).toBe(dense.at(-1))
  })
})

describe('vítr na hřebeni', () => {
  const raw = (levels: Array<[number, number, number]>): RawLocation => {
    const hourly: Record<string, Array<number | null>> = { time: ['2026-09-20T10:00'] as unknown as number[] }
    for (const [hpa, height, speed] of levels) {
      hourly[`wind_speed_${hpa}hPa`] = [speed]
      hourly[`geopotential_height_${hpa}hPa`] = [height]
    }
    return { latitude: 50, longitude: 15, elevation: 1603, hourly }
  }

  it('interpoluje vítr volné atmosféry do výšky vrcholu', () => {
    const r = raw([
      [850, 1500, 40],
      [800, 2000, 60],
    ])
    expect(freeWindAt(r, 0, 1603)).toBeCloseTo(40 + (20 * 103) / 500, 5)
    expect(freeWindAt(r, 0, 2500)).toBe(60)
  })

  it('pod nejnižší hladinou nic nedopočítá — údolí není hřeben', () => {
    const r = raw([[850, 1500, 40]])
    expect(freeWindAt(r, 0, 900)).toBeNull()
  })
})

describe('pauza a osobní tempo', () => {
  const up = line([50.0, 15.0], [50.03, 15.0], (t) => 800 + 600 * t, 120)
  const wps: Waypoint[] = [
    { id: 'a', name: 'Dole', lat: 50.0, lon: 15.0, elevation: 800 },
    { id: 'b', name: 'Nahoře', lat: 50.03, lon: 15.0, elevation: 1400 },
  ]
  const oneWay: Track = {
    points: up,
    lengthKm: cumulativeKm(up).at(-1)!,
    ascentM: 600,
    descentM: 0,
    waypointIndices: [0, up.length - 1],
    fallback: false,
  }
  const route: Route = { id: 'r', name: 'Test', waypoints: wps, startTime: '08:00', pace: 'stredni', roundTrip: true }
  const walked = { ...route, waypoints: [...wps, wps[0]] }
  const day = new Date('2026-09-20T00:00:00')

  it('pauza nahoře prodlouží túru a nahoře se na ni čeká', () => {
    const track = withReturn(oneWay)
    const bez = planFromTrack(track, walked, day)
    const s = planFromTrack(track, { ...walked, breakMin: 30 }, day)
    expect(s.minutes).toBeCloseTo(bez.minutes + 30, 5)
    expect(s.walkingMinutes).toBeCloseTo(bez.minutes, 5)
    const top = s.arrivals[1]
    expect(top.leaveAt!.getTime() - top.at.getTime()).toBe(30 * 60000)
    // Příchod nahoru se pauzou nemění, návrat ano.
    expect(top.at.getTime()).toBe(bez.arrivals[1].at.getTime())
    expect(s.arrivals[2].at.getTime() - bez.arrivals[2].at.getTime()).toBe(30 * 60000)
  })

  it('osobní tempo zrychlí i zpomalí celý plán', () => {
    const track = withReturn(oneWay)
    const base = planFromTrack(track, walked, day).minutes
    expect(planFromTrack(track, { ...walked, paceScale: 1.25 }, day).minutes).toBeCloseTo(base / 1.25, 5)
  })

  it('kalibrace z ušlé túry má rozumné meze', () => {
    expect(calibrate(180, 150)).toBeCloseTo(1.2, 5)
    expect(calibrate(180, 20)).toBe(1.8)
    expect(calibrate(180, 0)).toBe(1)
  })

  it('nejpozdější start před bouřkou počítá i s pauzou nahoře', () => {
    const sites = [
      { id: 's0', lat: 50.0, lon: 15.0, elevation: 800, trackIndex: 0 },
      { id: 's1', lat: 50.03, lon: 15.0, elevation: 1400, trackIndex: up.length - 1 },
    ]
    const hours = (storm: boolean): HourPoint[] =>
      Array.from({ length: 48 }, (_, i) => ({
        time: `2026-09-20T${String(i % 24).padStart(2, '0')}:00`.replace('2026-09-20', i < 24 ? '2026-09-20' : '2026-09-21'),
        temperature: 12, apparentTemperature: 11, apparentTemperatureRisk: 11,
        precipitation: 0, precipitationRisk: 0, precipitationProbability: storm && i === 12 ? 80 : 0,
        snowfall: 0, snowfallRisk: 0, windSpeed: 5, windDirection: 0, windGusts: 10, windGustsRisk: 10,
        windGustsHigh: 10, ridgeWind: false, cape: storm && i === 12 ? 900 : 0, capeRisk: storm && i === 12 ? 900 : 0,
        cloudCover: 10, cloudLow: 0, cloudMid: 0, cloudHigh: 10, visibility: 30000, freezingLevel: 3000,
        snowDepth: 0, humidity: 50, uvIndex: 3, levels: [], aerosol: null, members: 40,
      }))
    const forecast: Forecast = {
      sites,
      points: sites.map((s) => ({
        siteId: s.id,
        hours: hours(true),
        spread: hours(true).map(() => ({ temperature: 0, windGusts: 0, precipitation: 0, members: 40 })),
      })),
      days: [{ date: '2026-09-20', sunrise: '2026-09-20T06:50', sunset: '2026-09-20T19:00' }],
      fetchedAt: Date.now(),
      ensembles: ['icon_d2_eps'],
    }
    const track = withReturn(oneWay)
    const start = new Date('2026-09-20T08:00:00')
    const bez = assess(route, track, forecast, start)
    const s = assess({ ...route, breakMin: 40 }, track, forecast, start)
    expect(bez.storm).not.toBeNull()
    expect(bez.storm!.from.getHours()).toBe(12)
    expect(bez.storm!.latestStart.getTime() - s.storm!.latestStart.getTime()).toBe(40 * 60000)
  })
})
