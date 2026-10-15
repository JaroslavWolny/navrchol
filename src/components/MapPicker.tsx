import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { Icon } from './Icon'
import { LINE, createMap, pinIcon, topoLayer, trailsLayer } from './maps'
import type { Track } from '../lib/routing'
import type { Waypoint } from '../lib/types'

interface Props {
  waypoints: Waypoint[]
  track: Track | null
  /** Bez obsluhy je mapa jen na prohlížení (trasa z GPX). */
  onAdd?: (lat: number, lon: number) => void
  onMove?: (id: string, lat: number, lon: number) => void
  height: number
}

/**
 * Mapa v editoru: ťuknutím se přidá bod, tažením se posune. Pod tím
 * topografická mapa a značené trasy, ať se body trefují na pěšiny.
 */
export function MapPicker({ waypoints, track, onAdd, onMove, height }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const handlers = useRef({ onAdd, onMove })
  handlers.current = { onAdd, onMove }
  const fitted = useRef(false)
  const [locating, setLocating] = useState(false)

  useEffect(() => {
    if (!host.current || map.current) return
    const m = createMap(host.current).setView([50.1, 15.3], 7)
    topoLayer().addTo(m)
    trailsLayer().addTo(m)
    L.control.zoom({ position: 'bottomright' }).addTo(m)
    m.on('click', (e: L.LeafletMouseEvent) => handlers.current.onAdd?.(e.latlng.lat, e.latlng.lng))
    layer.current = L.layerGroup().addTo(m)
    map.current = m
    // Nová mapa (i po znovupřipojení komponenty) se musí na trasu srovnat znovu.
    fitted.current = false
    return () => {
      m.remove()
      map.current = null
    }
  }, [])

  useEffect(() => {
    const m = map.current
    const g = layer.current
    if (!m || !g) return
    g.clearLayers()

    if (track && track.points.length > 1) {
      const line = track.points.map((p) => [p.lat, p.lon] as [number, number])
      L.polyline(line, { color: LINE.halo, weight: LINE.haloWeight, opacity: 0.95, lineJoin: 'round' }).addTo(g)
      L.polyline(line, { color: LINE.ink, weight: LINE.inkWeight, lineJoin: 'round' }).addTo(g)
      L.polyline(line, {
        color: getComputedStyle(document.documentElement).getPropertyValue('--go').trim() || '#c8f169',
        weight: LINE.coreWeight,
        lineJoin: 'round',
        dashArray: track.fallback ? '6 7' : undefined,
      }).addTo(g)
    }

    const last = waypoints.length - 1
    waypoints.forEach((w, i) => {
      const marker = L.marker([w.lat, w.lon], {
        icon: pinIcon(String(i + 1), i === 0 ? 'num' : i === last ? 'end' : 'mid'),
        keyboard: false,
        draggable: Boolean(handlers.current.onMove),
        autoPan: true,
      })
      marker.on('dragend', () => {
        const p = marker.getLatLng()
        handlers.current.onMove?.(w.id, p.lat, p.lng)
      })
      marker.addTo(g)
    })

    // Pohled se srovná jen poprvé; při přidávání bodů mapa neposkakuje,
    // jen se posune, když nový bod leží mimo výřez.
    if (waypoints.length > 0) {
      const bounds = L.latLngBounds(waypoints.map((w) => [w.lat, w.lon] as [number, number]))
      if (track && track.points.length > 1) bounds.extend(L.latLngBounds(track.points.map((p) => [p.lat, p.lon] as [number, number])))
      if (!fitted.current) {
        fitted.current = true
        m.invalidateSize()
        if (waypoints.length === 1) m.setView([waypoints[0].lat, waypoints[0].lon], 13)
        else m.fitBounds(bounds, { padding: [36, 36], maxZoom: 15 })
      } else if (!m.getBounds().contains(bounds)) {
        m.fitBounds(bounds, { padding: [36, 36], maxZoom: m.getZoom() })
      }
    }
  }, [waypoints, track])

  const locate = () => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        map.current?.setView([pos.coords.latitude, pos.coords.longitude], 14)
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }

  return (
    <div className="map" style={{ height }}>
      <div ref={host} style={{ width: '100%', height: '100%' }} />
      {onAdd && waypoints.length < 2 && (
        <div className="map-hint">{waypoints.length === 0 ? 'Ťukni na start trasy' : 'Ťukni na další bod'}</div>
      )}
      <button className="map-fab" style={{ right: 12, top: 12 }} onClick={locate} aria-label="Moje poloha">
        <Icon name="locate" size={20} stroke={1.9} className={locating ? 'spin' : undefined} />
      </button>
    </div>
  )
}
