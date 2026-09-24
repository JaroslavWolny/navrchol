import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Icon } from '../components/Icon'
import { Screen } from '../components/Screen'
import { Cell, Sheet } from '../components/ui'
import { Empty } from '../components/States'
import { useAllOutlooks } from '../state/useRouteData'
import { importGpx } from '../lib/gpx'
import { verdictOf } from '../lib/score'
import { capital, clock, dayLabel, durationShort, km, metres } from '../lib/format'
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
      <button className="icon-btn" onClick={onSettings} aria-label="Nastavení">
        <Icon name="settings" size={23} />
      </button>
      <button className="icon-btn" onClick={onNew} aria-label="Nová trasa">
        <Icon name="plus" size={25} stroke={2} />
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
        <Icon name="file" size={19} stroke={2} />
        {importing ? 'Načítám GPX…' : 'Importovat GPX'}
      </button>
    </>
  )

  return (
    <Screen title="Trasy" actions={actions}>
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
        <div className="page stack mt-8" style={{ gap: 10 }}>
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
          <div className="stack mt-8" style={{ gap: 10 }}>
            <button className="btn" onClick={onNew}>
              <Icon name="plus" size={19} stroke={2.2} />
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

      <p className="footer-note">
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
                title={<span style={{ color: 'var(--stop)', fontWeight: 600 }}>Opravdu smazat</span>}
                sub="Nedá se vrátit."
                onClick={() => {
                  onDelete(menuFor.id)
                  setMenuFor(null)
                }}
              />
            ) : (
              <Cell icon="trash" tone="nejdi" title={<span style={{ color: 'var(--stop)' }}>Smazat trasu</span>} onClick={() => setConfirming(true)} />
            )}
          </div>
        )}
      </Sheet>
    </Screen>
  )
}

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
  let meta: ReactNode = route.waypoints.map((w) => w.name).join(' → ')
  if (track) {
    meta = `${km(track.lengthKm)} · ↑ ${metres(track.ascentM)}${best ? ` · ${durationShort((best.endsAt.getTime() - best.start.getTime()) / 60000)}` : ''}`
  }

  return (
    <div className="card" style={{ position: 'relative', boxShadow: active ? '0 0 0 1.5px var(--accent)' : undefined }}>
      <button onClick={onPick} style={{ display: 'block', width: '100%', padding: '14px 16px 14px', textAlign: 'left' }}>
        <div className="between" style={{ alignItems: 'flex-start', paddingRight: 36 }}>
          <div className="grow">
            <div className="row" style={{ gap: 8 }}>
              <span className="t-headline truncate">{route.name || 'Bez názvu'}</span>
              {route.id === DEMO_ROUTE_ID && <span className="tag">ukázka</span>}
              {route.track && <span className="tag">GPX</span>}
            </div>
            <div className="t-sub muted mt-4 truncate">{meta}</div>
          </div>
        </div>

        <div className="between mt-12" style={{ alignItems: 'flex-end', gap: 14 }}>
          <div className="grow">
            {best ? (
              <>
                <div className="t-cap faint">Nejlépe tento týden</div>
                <div className="t-callout mt-4" style={{ fontWeight: 600 }}>
                  {capital(dayLabel(best.start))}, {clock(best.start)}
                </div>
              </>
            ) : loading ? (
              <div className="skel" style={{ height: 30, width: '70%' }} />
            ) : (
              <div className="t-sub faint">Tento týden nevychází</div>
            )}
          </div>
          {oneWay && <Sparkline points={oneWay} />}
          {best && (
            <span className="badge" data-tone={verdictOf(best.score)} style={{ height: 30, fontSize: 15, padding: '0 10px' }}>
              {best.score}
            </span>
          )}
        </div>
      </button>
      <button
        className="icon-btn"
        onClick={onMenu}
        aria-label={`Možnosti trasy ${route.name}`}
        style={{ position: 'absolute', top: 4, right: 4, color: 'var(--ink-3)' }}
      >
        <Icon name="more" size={22} />
      </button>
    </div>
  )
}

/** Výškový profil v malém — trasy se tak dají poznat i bez čtení názvu. */
function Sparkline({ points }: { points: Array<{ elevation: number }> }) {
  const W = 84
  const H = 30
  const step = Math.max(1, Math.floor(points.length / 60))
  const pts = points.filter((_, i) => i % step === 0 || i === points.length - 1)
  const lo = Math.min(...pts.map((p) => p.elevation))
  const hi = Math.max(...pts.map((p) => p.elevation))
  const y = (e: number) => H - 2 - ((e - lo) / Math.max(1, hi - lo)) * (H - 6)
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${((i / (pts.length - 1)) * W).toFixed(1)} ${y(p.elevation).toFixed(1)}`).join('')
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d={`${line}L${W} ${H}L0 ${H}Z`} fill="var(--terrain)" opacity="0.8" />
      <path d={line} fill="none" stroke="var(--terrain-line)" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}
