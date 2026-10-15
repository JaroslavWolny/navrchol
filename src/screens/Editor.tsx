import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { MapPicker } from '../components/MapPicker'
import { Screen } from '../components/Screen'
import { Cell, Section, Segmented, Switch } from '../components/ui'
import { searchPlaces, type Place } from '../lib/geocode'
import { lookupElevation } from '../lib/elevation'
import { fetchTrack, trackFromPoints, withReturn, type Track } from '../lib/routing'
import { flatSpeed, planFromTrack } from '../lib/pace'
import { walkedRoute } from '../lib/plan'
import { isLoop } from '../lib/geo'
import { duration, km, metres, num } from '../lib/format'
import { newId } from '../state/store'
import type { PaceKey, Route, Waypoint } from '../lib/types'

const PACES: Array<{ id: PaceKey; label: string }> = [
  { id: 'pomale', label: 'Pohodově' },
  { id: 'stredni', label: 'Běžně' },
  { id: 'svizne', label: 'Svižně' },
]

const BREAKS = [0, 10, 20, 30, 45, 60]

interface Props {
  route: Route
  paceScale: number
  isNew: boolean
  onSave: (route: Route) => void
  onCancel: () => void
  onDelete?: () => void
}

export function EditorScreen({ route: initial, paceScale, isNew, onSave, onCancel, onDelete }: Props) {
  const [route, setRoute] = useState<Route>(initial)
  const [routed, setRouted] = useState<Track | null>(null)
  const [routing, setRouting] = useState(false)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<Place[]>([])
  const [searching, setSearching] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const patch = (p: Partial<Route>) => setRoute((r) => ({ ...r, ...p }))
  const fromGpx = Boolean(route.track && route.track.length > 1)

  // Náhled trati se přepočítá, když se změní body — ale ne dřív než za půl vteřiny,
  // ať se veřejná routovací služba nezasype při rychlém klikání.
  useEffect(() => {
    if (fromGpx || route.waypoints.length < 2) {
      setRouted(null)
      return
    }
    const controller = new AbortController()
    setRouting(true)
    const timer = setTimeout(() => {
      fetchTrack(route.waypoints, controller.signal)
        .then(setRouted)
        .catch(() => setRouted(null))
        .finally(() => !controller.signal.aborted && setRouting(false))
    }, 500)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [route.waypoints, fromGpx])

  const searchTimer = useRef<number | undefined>(undefined)
  useEffect(() => {
    window.clearTimeout(searchTimer.current)
    if (query.trim().length < 2) {
      setHits([])
      setSearching(false)
      return
    }
    const controller = new AbortController()
    setSearching(true)
    searchTimer.current = window.setTimeout(() => {
      searchPlaces(query, controller.signal)
        .then(setHits)
        .catch(() => setHits([]))
        .finally(() => setSearching(false))
    }, 300)
    return () => {
      controller.abort()
      window.clearTimeout(searchTimer.current)
    }
  }, [query])

  const track = useMemo(
    () => (fromGpx ? trackFromPoints(route.track!, route.waypoints) : routed),
    [fromGpx, route.track, route.waypoints, routed],
  )
  const loop = isLoop(route.waypoints)
  // Okruh se vrací sám; přepínač tam a zpět by ho poslal ještě jednou.
  const roundTrip = route.roundTrip === true && !loop
  const preview = track && roundTrip ? withReturn(track) : track
  const plan = useMemo(
    () => (preview ? planFromTrack(preview, { ...walkedRoute({ ...route, roundTrip }), paceScale }, new Date()) : null),
    [preview, route, roundTrip, paceScale],
  )

  const addWaypoint = (w: Omit<Waypoint, 'id'>) =>
    setRoute((r) => ({ ...r, waypoints: [...r.waypoints, { ...w, id: newId() }] }))

  const addFromMap = async (lat: number, lon: number) => {
    const id = newId()
    // Bod se ukáže hned; výška z modelu terénu dorazí za chvilku.
    setRoute((r) => ({ ...r, waypoints: [...r.waypoints, { id, name: `Bod ${r.waypoints.length + 1}`, lat, lon, elevation: 0 }] }))
    const elevation = await lookupElevation(lat, lon)
    setRoute((r) => ({ ...r, waypoints: r.waypoints.map((w) => (w.id === id ? { ...w, elevation } : w)) }))
  }

  const moveOnMap = async (id: string, lat: number, lon: number) => {
    setRoute((r) => ({ ...r, waypoints: r.waypoints.map((w) => (w.id === id ? { ...w, lat, lon } : w)) }))
    const elevation = await lookupElevation(lat, lon)
    setRoute((r) => ({ ...r, waypoints: r.waypoints.map((w) => (w.id === id ? { ...w, elevation } : w)) }))
  }

  const addPlace = (p: Place) => {
    addWaypoint({ name: p.name, lat: p.lat, lon: p.lon, elevation: p.elevation })
    setQuery('')
    setHits([])
  }

  const removeWaypoint = (id: string) => setRoute((r) => ({ ...r, waypoints: r.waypoints.filter((w) => w.id !== id) }))

  const move = (index: number, delta: number) =>
    setRoute((r) => {
      const next = [...r.waypoints]
      const target = index + delta
      if (target < 0 || target >= next.length) return r
      ;[next[index], next[target]] = [next[target], next[index]]
      return { ...r, waypoints: next }
    })

  const canSave = route.waypoints.length >= 2 && route.waypoints.every((w) => Number.isFinite(w.elevation))

  const save = () => {
    if (!canSave) return
    const highest = [...route.waypoints].sort((a, b) => b.elevation - a.elevation)[0]
    onSave({ ...route, roundTrip, name: route.name.trim() || highest?.name || 'Moje trasa' })
  }

  return (
    <Screen
      compact
      title={isNew ? 'Nová trasa' : 'Upravit trasu'}
      leading={
        <button className="bar-btn" onClick={onCancel}>
          Zrušit
        </button>
      }
      actions={
        <button className="bar-btn bar-btn--strong" onClick={save} disabled={!canSave}>
          Uložit
        </button>
      }
    >
      <MapPicker
        waypoints={route.waypoints}
        track={track}
        onAdd={fromGpx ? undefined : (lat, lon) => void addFromMap(lat, lon)}
        onMove={fromGpx ? undefined : (id, lat, lon) => void moveOnMap(id, lat, lon)}
        height={300}
      />

      {!fromGpx && (
        <div className="page mt-12">
          <div className="search">
            <Icon name="search" size={17} stroke={2.2} />
            <input
              className="field"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Najít vrchol, chatu, obec…"
              aria-label="Najít místo"
              enterKeyHint="search"
            />
          </div>
        </div>
      )}
      {(hits.length > 0 || (searching && query.trim().length >= 2)) && (
        <div className="list mt-8">
          {searching && hits.length === 0 && <Cell title={<span className="muted">Hledám…</span>} />}
          {hits.map((p, i) => (
            <Cell
              key={`${p.name}-${i}`}
              icon="mountain"
              title={p.name}
              sub={`${metres(p.elevation)} · ${p.context}`}
              onClick={() => addPlace(p)}
            >
              <Icon name="plus" size={20} stroke={2.2} color="var(--accent)" />
            </Cell>
          ))}
        </div>
      )}

      {plan && preview && (
        <div className="page mt-12">
          <div className="card card-pad between">
            <div className="kv">
              <span>Délka</span>
              <b>{km(preview.lengthKm)}</b>
            </div>
            <div className="kv">
              <span>Stoupání</span>
              <b>{metres(preview.ascentM)}</b>
            </div>
            <div className="kv">
              <span>Chůze</span>
              <b>{duration(plan.walkingMinutes)}</b>
            </div>
            <div className="kv">
              <span>Celkem</span>
              <b>{duration(plan.minutes)}</b>
            </div>
          </div>
          {track?.fallback && (
            <p className="section-ft" style={{ paddingInline: 4 }}>
              Pěšina se mezi body nenašla, trasa je vzdušnou čarou s výškami terénu.
            </p>
          )}
        </div>
      )}
      {routing && !plan && route.waypoints.length >= 2 && <p className="footer-note">Hledám cestu po pěšinách…</p>}

      <Section title="Název">
        <div className="page">
          <input
            className="field"
            value={route.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder={[...route.waypoints].sort((a, b) => b.elevation - a.elevation)[0]?.name ?? 'Třeba Sněžka z Pece'}
            aria-label="Název trasy"
          />
        </div>
      </Section>

      <Section
        title="Body trasy"
        aside={route.waypoints.length > 0 ? <span className="aside">{route.waypoints.length}</span> : undefined}
        footer={
          fromGpx
            ? 'Trasa je z GPX a jde se přesně po ní. Body slouží jen jako popisky.'
            : route.waypoints.length === 0
              ? 'Ťukni do mapy, nebo najdi místo podle jména. Bod se dá přetáhnout.'
              : undefined
        }
      >
        {route.waypoints.length > 0 && (
          <div className="list">
            {route.waypoints.map((w, i) => (
              <div className="cell" key={w.id} style={{ gap: 8, paddingRight: 6 }}>
                <span className="badge" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', minWidth: 26, justifyContent: 'center' }}>
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
                  className="grow"
                  style={{ border: 'none', background: 'none', padding: '6px 0', outline: 'none', minWidth: 0 }}
                />
                <span className="t-foot faint num nowrap">{w.elevation ? metres(w.elevation) : '…'}</span>
                {!fromGpx && (
                  <>
                    <button
                      className="icon-btn"
                      style={{ width: 36, height: 36 }}
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      aria-label={`Posunout ${w.name} výš`}
                    >
                      <Icon name="arrowUp" size={17} stroke={2} color={i === 0 ? 'var(--ink-4)' : undefined} />
                    </button>
                    <button
                      className="icon-btn"
                      style={{ width: 36, height: 36, color: 'var(--stop)' }}
                      onClick={() => removeWaypoint(w.id)}
                      aria-label={`Smazat ${w.name}`}
                    >
                      <Icon name="trash" size={17} stroke={2} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
        {!fromGpx && route.waypoints.length >= 2 && (
          <div className="page row mt-12" style={{ gap: 8 }}>
            <button
              className="btn btn--gray btn--small"
              onClick={() => patch({ waypoints: [...route.waypoints].reverse() })}
            >
              <Icon name="swap" size={16} stroke={2.2} />
              Obrátit směr
            </button>
            {!loop && (
              <button
                className="btn btn--gray btn--small"
                onClick={() =>
                  setRoute((r) => ({
                    ...r,
                    roundTrip: false,
                    waypoints: [...r.waypoints, { ...r.waypoints[0], id: newId() }],
                  }))
                }
              >
                <Icon name="refresh" size={16} stroke={2.2} />
                Uzavřít okruh
              </button>
            )}
          </div>
        )}
        {fromGpx && (
          <div className="page mt-12">
            <button
              className="btn btn--gray btn--small"
              onClick={() => patch({ track: undefined })}
            >
              <Icon name="edit" size={16} stroke={2.2} />
              Upravit body ručně
            </button>
          </div>
        )}
      </Section>

      <Section
        title="Plán"
        footer={
          roundTrip
            ? 'Tam a zpět počítá i návrat po stejné cestě — do času, do rezervy do tmy i do skóre. Vypni, když se vracíš lanovkou, autobusem nebo jinudy.'
            : loop
              ? 'Okruh končí na startu, návrat je součástí trasy.'
              : 'Počítá se jen cesta tam. Zapni tam a zpět, když se vracíš stejnou cestou.'
        }
      >
        <div className="list">
          <Cell icon="clock" title="Start">
            <label className="pill time-pick">
              {route.startTime.replace(/^0/, '')}
              <input
                type="time"
                value={route.startTime}
                onChange={(e) => e.target.value && patch({ startTime: e.target.value })}
                aria-label="Čas startu"
              />
            </label>
          </Cell>
          {!loop && (
            <Cell icon="swap" title="Tam a zpět">
              <Switch
                checked={roundTrip}
                onChange={(v) => patch({ roundTrip: v })}
                label="Tam a zpět"
              />
            </Cell>
          )}
          <div className="cell" style={{ ['--inset' as string]: '58px', flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
            <div className="row" style={{ gap: 12 }}>
              <span className="cell-icon">
                <Icon name="pause" size={18} stroke={2} />
              </span>
              <span className="cell-title grow">Pauza nahoře</span>
              <span className="t-foot faint">{route.breakMin ? `${route.breakMin} min` : 'bez pauzy'}</span>
            </div>
            <Segmented
              label="Pauza nahoře v minutách"
              value={route.breakMin ?? 0}
              options={BREAKS.map((b) => ({ id: b, label: String(b) }))}
              onChange={(v) => patch({ breakMin: v })}
            />
          </div>
          <div className="cell" style={{ ['--inset' as string]: '58px', flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
            <div className="row" style={{ gap: 12 }}>
              <span className="cell-icon">
                <Icon name="walk" size={18} stroke={2} />
              </span>
              <span className="cell-title grow">Tempo</span>
              <span className="t-foot faint">
                po rovině {num(flatSpeed(route.pace, paceScale), 1)}&nbsp;km/h
              </span>
            </div>
            <Segmented label="Tempo" value={route.pace} options={PACES} onChange={(v) => patch({ pace: v })} />
          </div>
        </div>
      </Section>

      {onDelete && (
        <div className="page mt-24">
          <button className="btn btn--danger" onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}>
            <Icon name="trash" size={18} stroke={2} />
            {confirmDelete ? 'Opravdu smazat? Nedá se vrátit.' : 'Smazat trasu'}
          </button>
        </div>
      )}
    </Screen>
  )
}
