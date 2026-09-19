import { useEffect, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { MapPicker } from '../components/MapPicker'
import { Section } from '../components/Section'
import { lookupElevation, searchPlaces, type Place } from '../lib/geocode'
import { fetchTrack, type Track } from '../lib/routing'
import { formatDuration, planFromTrack } from '../lib/pace'
import { walkedRoute } from '../lib/plan'
import { withReturn } from '../lib/routing'
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

  // Náhled musí ukazovat túru tak, jak se opravdu půjde — včetně cesty zpátky.
  const preview = track && route.roundTrip ? withReturn(track) : track
  const canSave = route.waypoints.length >= 2
  const highest = route.waypoints.length
    ? [...route.waypoints].sort((a, b) => b.elevation - a.elevation)[0]
    : null

  return (
    <div className="app">
      <div className="topbar">
        <button className="btn-icon" onClick={onCancel} aria-label="Zpět">
          <Icon name="back" size={20} stroke={2} />
        </button>
        <input
          className="cond"
          value={route.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder="Název trasy"
          aria-label="Název trasy"
          style={{
            flexGrow: 1,
            minWidth: 0,
            fontSize: 19,
            fontWeight: 700,
            background: 'none',
            border: 'none',
            padding: 0,
          }}
        />
        <button
          onClick={() => canSave && onSave({ ...route, name: route.name.trim() || 'Bez názvu' })}
          disabled={!canSave}
          className="btn"
          style={{ width: 'auto', minHeight: 34, padding: '0 14px', fontSize: 13 }}
        >
          Uložit
        </button>
      </div>

      <div className="scroll">
        <div className="sec" style={{ marginTop: 14 }}>
          <div className="frame" style={{ height: 262 }}>
            <MapPicker waypoints={route.waypoints} track={track} onAdd={addFromMap} />
            <div className="frame-tag">ťuknutím přidáš bod</div>
          </div>
        </div>

        <div className="sec sec--tight">
          <input
            className="field"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Najít místo — Sněžka, Praděd, Zermatt…"
            aria-label="Najít místo"
          />
          {searching && (
            <div className="footnote" style={{ marginTop: 7 }}>
              hledám…
            </div>
          )}
          {hits.length > 0 && (
            <div className="rows" style={{ marginTop: 6 }}>
              {hits.map((p, i) => (
                <button key={`${p.name}-${i}`} className="row row--tap" onClick={() => addPlace(p)}>
                  <Icon name="peak" size={16} color="var(--paper-3)" />
                  <span style={{ flexGrow: 1, minWidth: 0 }}>
                    <span className="truncate" style={{ display: 'block', fontSize: 14.5, fontWeight: 500 }}>
                      {p.name}
                    </span>
                    <span className="footnote truncate" style={{ display: 'block' }}>
                      {metres(p.elevation)} · {p.context}
                    </span>
                  </span>
                  <Icon name="plus" size={17} stroke={2.2} />
                </button>
              ))}
            </div>
          )}
        </div>

        {preview && (
          <div className="sec sec--tight">
            <div className="stats">
              <div>
                <b>{km(preview.lengthKm)}</b>
                <span className="label">Délka</span>
              </div>
              <div>
                <b>{metres(preview.ascentM)}</b>
                <span className="label">Stoupání</span>
              </div>
              <div>
                <b>{formatDuration(planFromTrack(preview, walkedRoute(route), new Date()).minutes)}</b>
                <span className="label">Odhad</span>
              </div>
            </div>
          </div>
        )}

        <Section label="Start a tempo">
          <div className="row">
            <span className="label row-key">Vyrazím v</span>
            <input
              type="time"
              className="mono"
              value={route.startTime}
              onChange={(e) => patch({ startTime: e.target.value })}
              aria-label="Čas startu"
              style={{
                marginLeft: 'auto',
                background: 'none',
                border: 'none',
                fontSize: 19,
                fontWeight: 600,
                padding: 0,
                textAlign: 'right',
              }}
            />
          </div>
          <div className="seg" style={{ marginTop: 12 }}>
            {PACES.map((p) => (
              <button key={p.id} aria-pressed={route.pace === p.id} onClick={() => patch({ pace: p.id })}>
                {p.label}
              </button>
            ))}
          </div>

          <div className="seg" style={{ marginTop: 10 }}>
            <button aria-pressed={route.roundTrip !== false} onClick={() => patch({ roundTrip: true })}>
              Tam a zpět
            </button>
            <button aria-pressed={route.roundTrip === false} onClick={() => patch({ roundTrip: false })}>
              Jen tam
            </button>
          </div>
          <p className="footnote" style={{ marginTop: 8 }}>
            Tam a zpět počítá i návrat po stejné trati — do času, do rezervy do tmy i do toho,
            které hodiny se oskórují. Odpoledne na hřebeni je přesně ta část túry, kterou
            jednosměrný plán zatají. „Jen tam" nech, když se vracíš lanovkou nebo jinudy.
          </p>
        </Section>

        <Section label="Body trasy" meta={route.waypoints.length > 0 ? `${route.waypoints.length}` : undefined}>
          {route.waypoints.length === 0 ? (
            <p className="body">
              Zatím nic. Ťukni do mapy nebo najdi místo podle jména — potřebuješ aspoň dva body.
            </p>
          ) : (
            <div className="rows">
              {route.waypoints.map((w, i) => (
                <div className="row" key={w.id}>
                  <span className="wp-num" data-top={w.id === highest?.id && route.waypoints.length > 1}>
                    {i + 1}
                  </span>
                  <input
                    value={w.name}
                    aria-label={`Název bodu ${i + 1}`}
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
                      fontSize: 14,
                      fontWeight: 500,
                      padding: 0,
                    }}
                  />
                  <span className="mono" style={{ fontSize: 11.5, color: 'var(--paper-3)', flexShrink: 0 }}>
                    {metres(w.elevation)}
                  </span>
                  <button
                    className="btn-icon"
                    style={{ width: 32, height: 32 }}
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label="Posunout nahoru"
                  >
                    <Icon name="arrowUp" size={15} stroke={2} color={i === 0 ? 'var(--rule)' : undefined} />
                  </button>
                  <button
                    className="btn-icon"
                    style={{ width: 32, height: 32 }}
                    onClick={() => removeWaypoint(w.id)}
                    aria-label={`Smazat ${w.name}`}
                  >
                    <Icon name="trash" size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Section>

        {onDelete && (
          <div className="sec" style={{ marginTop: 28 }}>
            <button onClick={onDelete} className="btn btn--ghost btn--danger">
              <Icon name="trash" size={16} />
              Smazat trasu
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
