import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { Icon } from './Icon'
import { fetchRadar, radarTemplate, type RadarFrame } from '../lib/radar'
import { clock } from '../lib/format'
import type { Track } from '../lib/routing'

interface Props {
  track: Track | null
  center: { lat: number; lon: number }
}

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
        // Zrušený požadavek není porucha — přesně to dělá úklid efektu
        // při odchodu z obrazovky i dvojí spuštění ve StrictMode.
        if (!controller.signal.aborted) setFailed(true)
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!host.current || map.current) return
    const m = L.map(host.current, { zoomControl: false, attributionControl: true, keyboard: false }).setView(
      [center.lat, center.lon],
      8,
    )
    // Tmavý podklad, ne topo: tady nejde o terén, ale o to, aby bylo vidět echo srážek.
    // CARTO free endpoint bez klíče je zrušený a servíruje dlaždice s vodoznakem.
    L.tileLayer(
      'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 15, attribution: 'Podklad &copy; Esri, HERE, Garmin, &copy; OpenStreetMap' },
    ).addTo(m)
    L.control.zoom({ position: 'bottomright' }).addTo(m)
    map.current = m
    return () => {
      m.remove()
      map.current = null
    }
  }, [])

  // Trasa nad mapou, ať je vidět, kam se ta přeháňka vlastně žene.
  useEffect(() => {
    const m = map.current
    if (!m || !track || track.points.length < 2) return
    const line = track.points.map((p) => [p.lat, p.lon] as [number, number])
    const poly = L.polyline(line, { color: 'oklch(0.96 0.008 95)', weight: 3, opacity: 0.95 }).addTo(m)
    return () => {
      poly.remove()
    }
  }, [track])

  // Výměna snímku. Nová vrstva se přidá a stará zmizí až po jejím načtení,
  // jinak by při každém posunu posuvníku problikla mapa.
  useEffect(() => {
    const m = map.current
    const frame = data?.frames[index]
    if (!m || !data || !frame) return

    const layer = L.tileLayer(radarTemplate(data.host, frame.path), { opacity: 0.75, maxZoom: 15 })
    const previous = radarLayer.current
    layer.on('load', () => previous?.remove())
    layer.addTo(m)
    radarLayer.current = layer
  }, [data, index])

  useEffect(() => {
    if (!playing || !data || data.frames.length < 2) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % data.frames.length), 550)
    return () => clearInterval(timer)
  }, [playing, data])

  if (failed) {
    return <p className="body">Radar se teď nenačetl. Zbytek předpovědi tím není dotčený.</p>
  }

  const frame = data?.frames[index]

  return (
    <div className="frame">
      <div style={{ position: 'relative', height: 192 }}>
        <div ref={host} style={{ width: '100%', height: '100%' }} />
        <div className="frame-tag">{frame ? `radar ${clock(frame.at)}` : 'načítám radar'}</div>
      </div>

      {data && data.frames.length > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 11,
            padding: '9px 10px',
            borderTop: '1px solid var(--rule)',
          }}
        >
          <button
            className="btn-icon"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? 'Zastavit' : 'Přehrát'}
            style={{ width: 32, height: 32 }}
          >
            {playing ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 4.5v15l13-7.5z" />
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
            style={{ flexGrow: 1, accentColor: 'var(--paper)', minHeight: 34 }}
          />
          <span className="mono" style={{ fontSize: 11, color: 'var(--paper-3)', flexShrink: 0 }}>
            {frame ? clock(frame.at) : '—'}
          </span>
        </div>
      )}

      <div
        className="footnote"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          padding: '8px 10px',
          borderTop: '1px solid var(--rule-soft)',
        }}
      >
        <Icon name="drop" size={11} stroke={2} />
        <span>RainViewer, poslední dvě hodiny</span>
      </div>
    </div>
  )
}
