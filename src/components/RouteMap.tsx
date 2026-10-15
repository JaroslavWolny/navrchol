import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { LINE, createMap, pinIcon, toneColors, topoLayer } from './maps'
import { verdictOf } from '../lib/score'
import type { Sample } from '../lib/plan'
import type { Track } from '../lib/routing'

interface Props {
  track: Track
  samples: Sample[]
  height?: number
}

/**
 * Skóre pro každý bod trati: z hodiny, ve které tam podle tempa budeš.
 * U túry tam a zpět se každé místo míjí dvakrát a ukáže se horší z obou
 * průchodů — na mapě je jedna čára, a má říct, kde to ten den zlobí.
 */
function scoreByPoint(track: Track, samples: Sample[]): number[] {
  const n = track.points.length
  const out = new Array<number>(n).fill(100)
  const sorted = [...samples].sort((a, b) => a.trackIndex - b.trackIndex || a.at.getTime() - b.at.getTime())
  for (let k = 0; k < sorted.length; k++) {
    const a = sorted[k]
    const b = sorted[k + 1] ?? a
    const s = Math.min(a.score, b.score)
    for (let i = a.trackIndex; i <= (k + 1 < sorted.length ? b.trackIndex : n - 1); i++) out[i] = Math.min(out[i], s)
  }
  if (track.turnIndex !== undefined) {
    const t = track.turnIndex
    for (let i = 0; i <= t; i++) out[i] = Math.min(out[i], out[2 * t - i] ?? 100)
  }
  return out
}

export function RouteMap({ track, samples, height = 220 }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!host.current || map.current) return
    const m = createMap(host.current, { scrollWheelZoom: false })
    topoLayer().addTo(m)
    layer.current = L.layerGroup().addTo(m)
    map.current = m
    return () => {
      m.remove()
      map.current = null
    }
  }, [])

  useEffect(() => {
    const m = map.current
    const g = layer.current
    if (!m || !g || track.points.length < 2) return
    g.clearLayers()

    const end = track.turnIndex ?? track.points.length - 1
    const pts = track.points.slice(0, end + 1)
    const scores = scoreByPoint(track, samples)
    const colors = toneColors()
    const latlngs = pts.map((p) => [p.lat, p.lon] as [number, number])

    // Kartografická kresba: světlý lem, černá čára, přes ni barevné jádro po úsecích.
    L.polyline(latlngs, { color: LINE.halo, weight: LINE.haloWeight, opacity: 0.95, lineJoin: 'round' }).addTo(g)
    L.polyline(latlngs, { color: LINE.ink, weight: LINE.inkWeight, opacity: 1, lineJoin: 'round' }).addTo(g)
    let from = 0
    for (let i = 1; i <= end; i++) {
      const tone = verdictOf(scores[i])
      if (i === end || verdictOf(scores[i + 1]) !== tone) {
        L.polyline(latlngs.slice(from, i + 1), {
          color: colors[tone],
          weight: LINE.coreWeight,
          opacity: 1,
          lineJoin: 'round',
          dashArray: track.fallback ? '6 7' : undefined,
        }).addTo(g)
        from = i
      }
    }

    const top = pts.reduce((best, p, i) => (p.elevation > pts[best].elevation ? i : best), 0)
    L.marker(latlngs[0], { icon: pinIcon('', 'dot'), keyboard: false, interactive: false }).addTo(g)
    if (end !== 0 && top !== end && track.turnIndex === undefined) {
      L.marker(latlngs[end], { icon: pinIcon('', 'dot'), keyboard: false, interactive: false }).addTo(g)
    }
    L.marker(latlngs[top], { icon: pinIcon('▲', 'top'), keyboard: false, interactive: false }).addTo(g)

    // Mapa mohla vzniknout dřív, než se obrazovka rozložila — bez přeměření
    // by trasu vměstnala do výřezu nulové velikosti a zůstala oddálená.
    m.invalidateSize()
    m.fitBounds(L.latLngBounds(latlngs), { padding: [28, 28], maxZoom: 15 })
  }, [track, samples])

  return <div ref={host} className="map" style={{ height }} />
}
