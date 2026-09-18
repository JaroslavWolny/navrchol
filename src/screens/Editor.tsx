import { useEffect, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { MapPicker } from '../components/MapPicker'
import { lookupElevation, searchPlaces, type Place } from '../lib/geocode'
import { fetchTrack, type Track } from '../lib/routing'
import { formatDuration, planFromTrack } from '../lib/pace'
import { km, metres } from '../lib/format'
import { newId } from '../state/store'
import type { PaceKey, Route, Waypoint } from '../lib/types'

const PACES: Array<{ id: PaceKey; label: string }> = [
  { id: 'pomale', label: 'Pomalé' },
  { id: 'stredni', label: 'Střední' },
  { id: 'svizne', label: 'Svižné' },
]

interface Props {
  route: Route
  onSave: (route: Route) => void
  onCancel: () => void
  onDelete?: () => void
}

export function EditorScreen({ route: initial, onSave, onCancel, onDelete }: Props) {
  const [route, setRoute] = useState<Route>(initial)
  const [track, setTrack] = useState<Track | null>(null)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<Place[]>([])
  const [searching, setSearching] = useState(false)

  const patch = (p: Partial<Route>) => setRoute((r) => ({ ...r, ...p }))

  // Náhled trati se přepočítá vždy, když se změní body — ale ne dřív než za půl vteřiny,
  // ať se veřejná routovací služba nezasype při rychlém klikání.
  useEffect(() => {
    if (route.waypoints.length < 2) {
      setTrack(null)
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(() => {
      fetchTrack(route.waypoints, controller.signal)
        .then(setTrack)
        .catch(() => setTrack(null))
    }, 500)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [route.waypoints])

  const searchTimer = useRef<number | undefined>(undefined)
  useEffect(() => {
    window.clearTimeout(searchTimer.current)
    if (query.trim().length < 2) {
      setHits([])
      return
    }
    const controller = new AbortController()
    setSearching(true)
    searchTimer.current = window.setTimeout(() => {
      searchPlaces(query, controller.signal)
        .then(setHits)
        .catch(() => setHits([]))
        .finally(() => setSearching(false))
    }, 350)
    return () => {
      controller.abort()
      window.clearTimeout(searchTimer.current)
    }
  }, [query])

  const addWaypoint = (w: Omit<Waypoint, 'id'>) =>
    setRoute((r) => ({ ...r, waypoints: [...r.waypoints, { ...w, id: newId() }] }))

  const addFromMap = async (lat: number, lon: number) => {
    const elevation = await lookupElevation(lat, lon)
    addWaypoint({ name: `Bod ${route.waypoints.length + 1}`, lat, lon, elevation })
  }

  const addPlace = (p: Place) => {
    addWaypoint({ name: p.name, lat: p.lat, lon: p.lon, elevation: p.elevation })
    setQuery('')
    setHits([])
    if (!route.name) patch({ name: p.name })
  }

  const removeWaypoint = (id: string) =>
    setRoute((r) => ({ ...r, waypoints: r.waypoints.filter((w) => w.id !== id) }))

  const move = (index: number, delta: number) =>
    setRoute((r) => {
      const next = [...r.waypoints]
      const target = index + delta
      if (target < 0 || target >= next.length) return r
      ;[next[index], next[target]] = [next[target], next[index]]
      return { ...r, waypoints: next }
    })

  const canSave = route.waypoints.length >= 2
  const highest = route.waypoints.length
    ? [...route.waypoints].sort((a, b) => b.elevation - a.elevation)[0]
    : null

  return (
    <div className="app">
      <div className="pad row-between" style={{ paddingTop: 20, paddingBottom: 12, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <button onClick={onCancel} aria-label="Zpět" style={{ padding: 4, color: 'var(--dim)' }}>
            <Icon name="back" size={22} stroke={2.2} />
          </button>
          <input
            value={route.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="Název trasy"
            className="disp"
            style={{
              fontSize: 19,
              fontWeight: 700,
              background: 'none',
              border: 'none',
              color: 'var(--fg)',
              minWidth: 0,
              flexGrow: 1,
              padding: 0,
              fontFamily: 'var(--font-disp)',
            }}
          />
        </div>
        <button
          onClick={() => canSave && onSave({ ...route, name: route.name.trim() || 'Bez názvu' })}
          disabled={!canSave}
          style={{
            minHeight: 34,
            padding: '0 14px',
            borderRadius: 17,
            background: canSave ? 'var(--acc)' : 'var(--card-3)',
            color: canSave ? 'var(--acc-ink)' : 'var(--faint)',
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          Uložit
        </button>
      </div>

      <div className="scroll">
        <div className="pad">
          <div
            style={{
              position: 'relative',
              height: 268,
              borderRadius: 18,
              overflow: 'hidden',
              border: '1px solid var(--line)',
            }}
          >
            <MapPicker waypoints={route.waypoints} track={track} onAdd={addFromMap} />
            <div
              className="mono"
              style={{
                position: 'absolute',
                left: 10,
                top: 10,
                zIndex: 500,
                fontSize: 9,
                letterSpacing: '0.08em',
                color: 'var(--fg)',
                background: 'rgba(0,0,0,0.6)',
                padding: '4px 7px',
                borderRadius: 6,
                pointerEvents: 'none',
              }}
            >
              ŤUKNUTÍM DO MAPY PŘIDÁŠ BOD
            </div>
          </div>
        </div>

        <div className="pad" style={{ marginTop: 12 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Najít místo — Sněžka, Praděd, Zermatt…"
            style={{
              width: '100%',
              minHeight: 46,
              padding: '0 14px',
              borderRadius: 12,
              background: 'var(--card-2)',
              border: '1px solid var(--line)',
              color: 'var(--fg)',
              fontSize: 14,
              fontFamily: 'var(--font)',
            }}
          />
          {searching && <div className="sub" style={{ marginTop: 6 }}>hledám…</div>}
          {hits.length > 0 && (
            <div className="stack" style={{ gap: 4, marginTop: 8 }}>
              {hits.map((p, i) => (
                <button
                  key={`${p.name}-${i}`}
                  onClick={() => addPlace(p)}
                  className="card-2"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', minHeight: 46 }}
                >
                  <Icon name="peak" size={16} color="var(--acc)" />
                  <span style={{ flexGrow: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, display: 'block' }}>{p.name}</span>
                    <span className="mono" style={{ fontSize: 10.5, color: 'var(--mute)' }}>
                      {metres(p.elevation)} · {p.context}
                    </span>
                  </span>
                  <Icon name="plus" size={18} stroke={2.2} color="var(--acc)" />
                </button>
              ))}
            </div>
          )}
        </div>

        {track && (
          <div className="pad" style={{ marginTop: 12, display: 'flex', gap: 7 }}>
            <Stat value={km(track.lengthKm)} label="DÉLKA" />
            <Stat value={metres(track.ascentM)} label="STOUPÁNÍ" />
            <Stat value={formatDuration(planFromTrack(track, route, new Date()).minutes)} label="ODHAD" />
          </div>
        )}

        <div className="pad" style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <div className="card-2" style={{ width: 118, flexShrink: 0 }}>
            <div style={{ fontSize: 9.5, color: 'var(--mute)', letterSpacing: '0.04em' }}>START</div>
            <input
              type="time"
              value={route.startTime}
              onChange={(e) => patch({ startTime: e.target.value })}
              className="mono"
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                color: 'var(--fg)',
                fontSize: 19,
                fontWeight: 700,
                padding: 0,
                fontFamily: 'var(--font-mono)',
              }}
            />
          </div>
          <div className="card-2" style={{ flexGrow: 1 }}>
            <div style={{ fontSize: 9.5, color: 'var(--mute)', letterSpacing: '0.04em', marginBottom: 6 }}>
              TEMPO
            </div>
            <div className="seg">
              {PACES.map((p) => (
                <button key={p.id} aria-pressed={route.pace === p.id} onClick={() => patch({ pace: p.id })}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="pad" style={{ marginTop: 14 }}>
          <div className="section-label" style={{ paddingBottom: 6 }}>
            BODY TRASY {route.waypoints.length > 0 && `(${route.waypoints.length})`}
          </div>
          {route.waypoints.length === 0 ? (
            <div className="card-2" style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.45 }}>
              Zatím nic. Ťukni do mapy nebo najdi místo podle jména — potřebuješ aspoň dva body.
            </div>
          ) : (
            <div className="stack" style={{ gap: 5 }}>
              {route.waypoints.map((w, i) => (
                <div key={w.id} className="card-2" style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 46 }}>
                  <span
                    className="mono"
                    style={{
                      width: 22,
                      height: 22,
                      flexShrink: 0,
                      borderRadius: 11,
                      border: `1.5px solid ${w.id === highest?.id && route.waypoints.length > 1 ? 'var(--acc)' : 'var(--faint)'}`,
                      color: w.id === highest?.id && route.waypoints.length > 1 ? 'var(--acc)' : 'var(--faint)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10.5,
                      fontWeight: 700,
                    }}
                  >
                    {i + 1}
                  </span>
                  <input
                    value={w.name}
                    onChange={(e) =>
                      setRoute((r) => ({
                        ...r,
                        waypoints: r.waypoints.map((x) => (x.id === w.id ? { ...x, name: e.target.value } : x)),
                      }))
                    }
                    style={{
                      flexGrow: 1,
                      minWidth: 0,
                      background: 'none',
                      border: 'none',
                      color: 'var(--fg)',
                      fontSize: 13.5,
                      fontWeight: 600,
                      padding: 0,
                      fontFamily: 'var(--font)',
                    }}
                  />
                  <span className="mono" style={{ fontSize: 11.5, color: 'var(--dim)', flexShrink: 0 }}>
                    {metres(w.elevation)}
                  </span>
                  <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Nahoru" style={{ padding: 5, color: i === 0 ? 'var(--card-3)' : 'var(--faint)' }}>
                    <Icon name="arrowUp" size={15} stroke={2.2} />
                  </button>
                  <button onClick={() => removeWaypoint(w.id)} aria-label={`Smazat ${w.name}`} style={{ padding: 5, color: 'var(--faint)' }}>
                    <Icon name="trash" size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {onDelete && (
          <div className="pad" style={{ marginTop: 20 }}>
            <button
              onClick={onDelete}
              className="btn btn-ghost"
              style={{ color: 'var(--stop)', borderColor: 'oklch(0.38 0.08 25)' }}
            >
              <Icon name="trash" size={17} />
              Smazat trasu
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="card-2" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
      <span className="mono" style={{ fontSize: 15, fontWeight: 700 }}>{value}</span>
      <span style={{ fontSize: 9.5, color: 'var(--mute)', letterSpacing: '0.04em' }}>{label}</span>
    </div>
  )
}
