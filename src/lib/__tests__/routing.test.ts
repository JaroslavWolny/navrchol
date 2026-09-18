import { describe, expect, it } from 'vitest'
import { fetchTrack, nearestIndex } from '../routing'
import { planFromTrack, planRoute } from '../pace'
import type { Route, Waypoint } from '../types'

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

describe('trať po pěšinách', () => {
  it('najde nejbližší bod trati', () => {
    const pts = [
      { lat: 50.0, lon: 15.0, elevation: 100 },
      { lat: 50.5, lon: 15.5, elevation: 200 },
      { lat: 51.0, lon: 16.0, elevation: 300 },
    ]
    expect(nearestIndex(pts, { lat: 50.52, lon: 15.48 })).toBe(1)
  })

  it('bez dost bodů vrátí nouzovou vzdušnou čáru', async () => {
    const t = await fetchTrack([PEC])
    expect(t.fallback).toBe(true)
    expect(t.points).toHaveLength(1)
  })

  it('stáhne skutečnou trať a ta je delší než vzdušná čára', { timeout: 30000 }, async () => {
    const track = await fetchTrack(route.waypoints)
    if (track.fallback) {
      console.warn('BRouter nedostupný, test trati přeskočen')
      return
    }

    expect(track.points.length).toBeGreaterThan(50)
    expect(track.lengthKm).toBeGreaterThan(6)
    expect(track.lengthKm).toBeLessThan(12)
    expect(track.ascentM).toBeGreaterThan(700)

    // Kvůli tomuhle to celé je: pěšina je výrazně delší než spojnice bodů.
    const primka = planRoute(route, new Date('2026-09-20T00:00:00'))
    expect(track.lengthKm).toBeGreaterThan(primka.distanceKm * 1.15)

    // Body trasy jsou na trati v pořadí, v jakém se jdou.
    const [i0, i1, i2] = track.waypointIndices
    expect(i0).toBeLessThan(i1)
    expect(i1).toBeLessThan(i2)

    // Trať má v každém bodě výšku, takže výškový profil je zdarma.
    expect(track.points.every((p) => Number.isFinite(p.elevation))).toBe(true)

    const plan = planFromTrack(track, route, new Date('2026-09-20T00:00:00'))
    expect(plan.arrivals).toHaveLength(3)
    expect(plan.arrivals[0].at.getHours()).toBe(7)
    expect(plan.arrivals[2].offsetMin).toBeGreaterThan(plan.arrivals[1].offsetMin)
    // Přes 800 m převýšení se za hodinu vyjít nedá a pět hodin je taky nesmysl.
    expect(plan.minutes).toBeGreaterThan(90)
    expect(plan.minutes).toBeLessThan(300)
  })
})
