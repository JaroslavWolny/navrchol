import { useEffect, useRef } from 'react'
import L from 'leaflet'
import type { Track } from '../lib/routing'
import type { Waypoint } from '../lib/types'

interface Props {
  waypoints: Waypoint[]
  track: Track | null
  onAdd: (lat: number, lon: number) => void
}

export function MapPicker({ waypoints, track, onAdd }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const onAddRef = useRef(onAdd)
  onAddRef.current = onAdd

  useEffect(() => {
    if (!host.current || map.current) return

    const m = L.map(host.current, { zoomControl: false, attributionControl: true, keyboard: false }).setView(
      [50.7361, 15.7397],
      12,
    )
    L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 17,
      attribution:
        '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>, SRTM | &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
    }).addTo(m)
    L.control.zoom({ position: 'bottomright' }).addTo(m)
    m.on('click', (e: L.LeafletMouseEvent) => onAddRef.current(e.latlng.lat, e.latlng.lng))

    layer.current = L.layerGroup().addTo(m)
    map.current = m

    return () => {
      m.remove()
      map.current = null
    }
  }, [])

  // Překreslení bodů a trati při každé změně.
  useEffect(() => {
    const m = map.current
    const g = layer.current
    if (!m || !g) return
    g.clearLayers()

    if (track && track.points.length > 1) {
      const line = track.points.map((p) => [p.lat, p.lon] as [number, number])
      L.polyline(line, { color: '#0b0d12', weight: 7, opacity: 0.55, lineCap: 'round' }).addTo(g)
      L.polyline(line, {
        color: 'oklch(0.80 0.13 200)',
        weight: 3.5,
        opacity: 1,
        lineCap: 'round',
        dashArray: track.fallback ? '7 6' : undefined,
      }).addTo(g)
    }

    const highest = waypoints.reduce(
      (best, w, i, arr) => (w.elevation > arr[best].elevation ? i : best),
      0,
    )

    waypoints.forEach((w, i) => {
      L.marker([w.lat, w.lon], {
        icon: L.divIcon({
          className: '',
          html: `<div class="wp-pin${i === highest && waypoints.length > 1 ? ' is-top' : ''}">${i + 1}</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        }),
        keyboard: false,
      }).addTo(g)
    })

    if (waypoints.length === 1) {
      m.setView([waypoints[0].lat, waypoints[0].lon], 13)
    } else if (waypoints.length > 1) {
      m.fitBounds(L.latLngBounds(waypoints.map((w) => [w.lat, w.lon] as [number, number])), {
        padding: [34, 34],
        maxZoom: 15,
      })
    }
  }, [waypoints, track])

  return <div ref={host} style={{ width: '100%', height: '100%' }} />
}
