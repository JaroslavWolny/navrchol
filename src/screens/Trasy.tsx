import { useMemo, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { Screen } from '../components/Screen'
import { Cell, Sheet } from '../components/ui'
import { Empty } from '../components/States'
import { useAllOutlooks } from '../state/useRouteData'
import { importGpx } from '../lib/gpx'
import { verdictOf } from '../lib/score'
import { capital, clock, dayLabel, durationShort, km, metres, plural } from '../lib/format'
import type { DayOutlook, PlannedRoute } from '../lib/plan'
import type { Track } from '../lib/routing'
import { DEMO_ROUTE_ID, newId, type StoredState } from '../state/store'
import type { Route } from '../lib/types'

/** Nejlepší den v týdnu pro danou trasu. */
function bestOfWeek(week: DayOutlook[]) {
  const withWindow = week.filter((d) => d.best)
  if (withWindow.length === 0) return null
  return withWindow.reduce((a, b) => (b.best!.score > a.best!.score ? b : a)).best
}

interface Props {
  state: StoredState
  activeRoute: Route | null
  onPick: (id: string) => void
  onNew: () => void
  onImported: (route: Route) => void
  onEdit: (route: Route) => void
  onDelete: (id: string) => void
  onSettings: () => void
}

export function TrasyScreen({ state, activeRoute, onPick, onNew, onImported, onEdit, onDelete, onSettings }: Props) {
  const planned: PlannedRoute[] = useMemo(
    () => state.routes.map((r) => ({ ...r, paceScale: state.settings.paceScale })),
    [state.routes, state.settings.paceScale],
  )
  const outlooks = useAllOutlooks(planned)
  const [menuFor, setMenuFor] = useState<Route | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const file = useRef<HTMLInputElement>(null)

  const onFile = async (f: File | undefined) => {
    if (!f) return
    setImporting(true)
    setImportError(null)
    try {
      const imported = await importGpx(await f.text())
      onImported({
        id: newId(),
        name: imported.name || f.name.replace(/\.gpx$/i, ''),
        waypoints: imported.waypoints,
        track: imported.track,
        startTime: '07:30',
        pace: 'stredni',
        // Okruh nebo záznam i s cestou zpátky už návrat obsahuje.
        roundTrip: false,
        breakMin: 20,
      })
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Soubor se nepodařilo přečíst.')
    } finally {
      setImporting(false)
      if (file.current) file.current.value = ''
    }
  }

  const actions = (
    <>
      <button className="icon-btn icon-btn--card" onClick={onSettings} aria-label="Nastavení">
        <Icon name="sliders" size={21} />
      </button>
      <button className="icon-btn icon-btn--ink" onClick={onNew} aria-label="Nová trasa">
        <Icon name="plus" size={20} stroke={2.2} />
      </button>
    </>
  )

  const importButton = (
    <>
      <input
        ref={file}
        type="file"
        accept=".gpx,application/gpx+xml,application/xml,text/xml,application/octet-stream"
        style={{ display: 'none' }}
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      <button className="btn btn--gray" onClick={() => file.current?.click()} disabled={importing}>
        <Icon name="file" size={18} stroke={1.9} />
        {importing ? 'Načítám GPX…' : 'Import GPX'}
      </button>
    </>
  )

  return (
    <Screen
      title="Trasy"
      actions={actions}
      subtitle={state.routes.length > 0 ? `${plural(state.routes.length, 'trasa', 'trasy', 'tras')} · předpověď na 7 dní` : undefined}
    >
      {state.routes.length === 0 ? (
        <>
          <Empty
            icon="trasy"
            title="Zatím žádná trasa"
            hint="Naklikej body na mapě, nebo nahraj GPX z Mapy.cz, Komootu či hodinek."
            action={{ label: 'Nová trasa', onClick: onNew }}
          />
          <div className="page">{importButton}</div>
        </>
      ) : (
        <div className="page stack" style={{ gap: 12, marginTop: 18, paddingInline: 14 }}>
          {state.routes.map((route) => {
            const o = outlooks[route.id]
            const best = o ? bestOfWeek(o.week) : null
            return (
              <RouteCard
                key={route.id}
                route={route}
                active={route.id === activeRoute?.id}
                track={o?.track ?? null}
                best={best}
                loading={!o && route.waypoints.length > 1}
                onPick={() => onPick(route.id)}
                onMenu={() => {
                  setConfirming(false)
                  setMenuFor(route)
                }}
              />
            )
          })}
          <div className="mt-8" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            <button className="btn" onClick={onNew}>
              <Icon name="plus" size={18} stroke={2.2} />
              Nová trasa
            </button>
            {importButton}
          </div>
        </div>
      )}

      {importError && (
        <div className="banner mt-12" data-tone="nejdi">
          <Icon name="warn" size={18} stroke={2} />
          {importError}
        </div>
      )}

      <p className="footer-note footer-note--plain">
        GPX vyexportuješ v Mapy.cz přes Sdílet → Export GPX. Trasy zůstávají jen v tomhle telefonu.
      </p>

      <Sheet open={menuFor !== null} title={menuFor?.name || 'Trasa'} onClose={() => setMenuFor(null)}>
        {menuFor && (
          <div className="list">
            <Cell
              icon="edit"
              title="Upravit trasu"
              onClick={() => {
                const r = menuFor
                setMenuFor(null)
                onEdit(r)
              }}
            />
            {confirming ? (
              <Cell
                icon="trash"
                tone="nejdi"
                title={<span style={{ color: 'var(--danger-ink)' }}>Opravdu smazat</span>}
                sub="Nedá se vrátit."
                onClick={() => {
                  onDelete(menuFor.id)
                  setMenuFor(null)
                }}
              />
            ) : (
              <Cell icon="trash" tone="nejdi" title={<span style={{ color: 'var(--danger-ink)' }}>Smazat trasu</span>} onClick={() => setConfirming(true)} />
            )}
          </div>
        )}
      </Sheet>
    </Screen>
  )
}

const WORD = { jdi: 'jdi', zvaz: 'zvaž', nejdi: 'nejdi' } as const

function RouteCard({
  route,
  active,
  track,
  best,
  loading,
  onPick,
  onMenu,
}: {
  route: Route
  active: boolean
  track: Track | null
  best: DayOutlook['best']
  loading: boolean
  onPick: () => void
  onMenu: () => void
}) {
  const oneWay = track ? (track.turnIndex !== undefined ? track.points.slice(0, track.turnIndex + 1) : track.points) : null
  const meta = track
    ? [km(track.lengthKm), `↑ ${metres(track.ascentM)}`, ...(best ? [durationShort((best.endsAt.getTime() - best.start.getTime()) / 60000)] : [])]
    : null

  return (
    <div className="route-card" data-active={active}>
      {oneWay && <Profile points={oneWay} />}
      <button className="route-hit" onClick={onPick}>
        <span className="stack" style={{ gap: 6, paddingRight: 36 }}>
          {(active || route.id === DEMO_ROUTE_ID || route.track) && (
            <span className="row" style={{ gap: 8 }}>
              {active && (
                <span className="route-active">
                  <i />
                  Aktivní
                </span>
              )}
              {route.id === DEMO_ROUTE_ID && <span className="tag">Ukázka</span>}
              {route.track && <span className="tag">GPX</span>}
            </span>
          )}
          <span className="route-name">{route.name || 'Bez názvu'}</span>
          {meta ? (
            <span className="route-meta">
              {meta.map((m) => (
                <span key={m}>{m}</span>
              ))}
            </span>
          ) : (
            <span className="route-meta truncate">{route.waypoints.map((w) => w.name).join(' → ')}</span>
          )}
        </span>

        <span className="between" style={{ alignItems: 'flex-end', marginTop: 18 }}>
          <span className="stack grow" style={{ gap: 3 }}>
            {best ? (
              <>
                <span className="label" style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--ink-2)' }}>
                  Nejlépe tento týden
                </span>
                <span className="route-best">
                  {capital(dayLabel(best.start))}, {clock(best.start)}
                </span>
              </>
            ) : loading ? (
              <span className="skel" style={{ height: 34, width: '62%' }} />
            ) : (
              <span className="label" style={{ color: 'var(--ink-2)' }}>
                Tento týden nevychází
              </span>
            )}
          </span>
          {best && (
            <span className="score-tile" data-tone={verdictOf(best.score)}>
              <b>{best.score}</b>
              <span>{WORD[verdictOf(best.score)]}</span>
            </span>
          )}
        </span>
      </button>
      <button className="icon-btn route-more" onClick={onMenu} aria-label={`Možnosti trasy ${route.name}`}>
        <Icon name="more" size={20} />
      </button>
    </div>
  )
}

/** Výškový profil přes spodek karty — trasy se tak dají poznat i bez čtení názvu. */
function Profile({ points }: { points: Array<{ elevation: number }> }) {
  const W = 132
  const H = 44
  const step = Math.max(1, Math.floor(points.length / 80))
  const pts = points.filter((_, i) => i % step === 0 || i === points.length - 1)
  const lo = Math.min(...pts.map((p) => p.elevation))
  const hi = Math.max(...pts.map((p) => p.elevation))
  const y = (e: number) => H - 4 - ((e - lo) / Math.max(1, hi - lo)) * (H - 8)
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${((i / (pts.length - 1)) * W).toFixed(1)} ${y(p.elevation).toFixed(1)}`).join('')
  return (
    <svg className="route-prof" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={`${line}L${W} ${H}L0 ${H}Z`} fill="var(--sunk)" />
      <path d={line} fill="none" stroke="var(--ink-2)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
