import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { Icon } from './Icon'
import { canvasLayer, createMap, prefersDark } from './maps'
import { fetchRadar, radarTemplate, type RadarFrame } from '../lib/radar'
import { clock } from '../lib/format'
import type { Track } from '../lib/routing'

interface Props {
  track: Track | null
  center: { lat: number; lon: number }
}

/** Srážkový radar za poslední dvě hodiny s trasou navrch — kam se ta přeháňka žene. */
export function RadarMap({ track, center }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const radarLayer = useRef<L.TileLayer | null>(null)

  const [data, setData] = useState<{ host: string; frames: RadarFrame[] } | null>(null)
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    fetchRadar(controller.signal)
      .then((d) => {
        setData(d)
        setFailed(false)
        setIndex(Math.max(0, d.frames.length - 1))
      })
      .catch(() => {
        // Zrušený požadavek není porucha — to dělá úklid efektu při odchodu.
        if (!controller.signal.aborted) setFailed(true)
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!host.current || map.current) return
    const m = createMap(host.current).setView([center.lat, center.lon], 8)
    canvasLayer(prefersDark()).addTo(m)
    map.current = m
    return () => {
      m.remove()
      map.current = null
    }
    // Střed se nastaví jednou; dál si mapu posouvá člověk.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const m = map.current
    if (!m || !track || track.points.length < 2) return
    const line = track.points.map((p) => [p.lat, p.lon] as [number, number])
    const casing = L.polyline(line, { color: prefersDark() ? '#000' : '#fff', weight: 6, opacity: 0.8 }).addTo(m)
    const poly = L.polyline(line, { color: prefersDark() ? '#fff' : '#18191b', weight: 2.5, opacity: 1 }).addTo(m)
    return () => {
      casing.remove()
      poly.remove()
    }
  }, [track])

  // Nová vrstva se přidá a stará zmizí až po načtení nové, jinak by mapa problikla.
  useEffect(() => {
    const m = map.current
    const frame = data?.frames[index]
    if (!m || !data || !frame) return
    const layer = L.tileLayer(radarTemplate(data.host, frame.path), { opacity: 0.8, maxZoom: 15 })
    const previous = radarLayer.current
    layer.on('load', () => previous?.remove())
    layer.addTo(m)
    radarLayer.current = layer
  }, [data, index])

  useEffect(() => {
    if (!playing || !data || data.frames.length < 2) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % data.frames.length), 600)
    return () => clearInterval(timer)
  }, [playing, data])

  if (failed) {
    return <p className="section-ft" style={{ paddingTop: 0 }}>Radar se teď nenačetl. Zbytek předpovědi tím není dotčený.</p>
  }

  const frame = data?.frames[index]

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div className="map" style={{ height: 210 }}>
        <div ref={host} style={{ width: '100%', height: '100%' }} />
        <div className="map-hint">{frame ? `Radar ${clock(frame.at)}` : 'Načítám radar…'}</div>
      </div>
      {data && data.frames.length > 1 && (
        <div className="row" style={{ gap: 10, padding: '8px 12px 10px 6px' }}>
          <button
            className="icon-btn"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? 'Zastavit' : 'Přehrát'}
          >
            {playing ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="6" y="5" width="4" height="14" rx="1.2" />
                <rect x="14" y="5" width="4" height="14" rx="1.2" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M7.5 5.2v13.6a.8.8 0 0 0 1.2.7l11-6.8a.8.8 0 0 0 0-1.4l-11-6.8a.8.8 0 0 0-1.2.7Z" />
              </svg>
            )}
          </button>
          <input
            type="range"
            min={0}
            max={data.frames.length - 1}
            value={index}
            onChange={(e) => {
              setPlaying(false)
              setIndex(Number(e.target.value))
            }}
            aria-label="Čas radarového snímku"
            style={{ flexGrow: 1, accentColor: 'var(--accent)' }}
          />
          <span className="t-foot num faint" style={{ width: 38, textAlign: 'right' }}>
            {frame ? clock(frame.at) : ''}
          </span>
        </div>
      )}
      <div className="t-cap faint row" style={{ padding: '0 14px 12px', gap: 6 }}>
        <Icon name="radar" size={13} />
        RainViewer, posledních 120 minut
      </div>
    </div>
  )
}
