import { Gauge } from '../components/Gauge'
import { Icon } from '../components/Icon'
import { Empty } from '../components/States'
import { useAllOutlooks } from '../state/useRouteData'
import { formatDuration } from '../lib/pace'
import { verdictOf } from '../lib/score'
import { bodu, clock, dayShort, km, metres, parseDay } from '../lib/format'
import type { DayOutlook } from '../lib/plan'
import { DEMO_ROUTE_ID, type StoredState } from '../state/store'
import type { Route } from '../lib/types'

const WORD = { jdi: 'jdi', zvaz: 'zvaž', nejdi: 'nejdi' } as const

/** Nejlepší den v týdnu pro danou trasu. */
function bestOfWeek(week: DayOutlook[]) {
  const withWindow = week.filter((d) => d.best)
  if (withWindow.length === 0) return null
  return withWindow.reduce((a, b) => (b.best!.score > a.best!.score ? b : a))
}

interface Props {
  state: StoredState
  activeRoute: Route | null
  onPick: (id: string) => void
  onNew: () => void
  onEdit: (route: Route) => void
  onAbout: () => void
}

export function TrasyScreen({ state, activeRoute, onPick, onNew, onEdit, onAbout }: Props) {
  const outlooks = useAllOutlooks(state.routes)

  return (
    <div className="scroll">
      <header className="masthead">
        <div className="between">
          <h1>Moje trasy</h1>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn-icon btn-icon--outline" onClick={onAbout} aria-label="O appce" style={{ fontSize: 16, fontWeight: 600 }}>
              ?
            </button>
            <button className="btn-icon btn-icon--solid" onClick={onNew} aria-label="Nová trasa">
              <Icon name="plus" size={20} stroke={2.2} />
            </button>
          </div>
        </div>
      </header>

      {state.routes.length === 0 ? (
        <Empty
          title="Zatím žádná trasa"
          hint="Přidej první túru: naklikej body na mapě a nastav, kdy chceš vyrazit."
          action={{ label: 'Nová trasa', onClick: onNew }}
        />
      ) : (
        <div className="sec" style={{ marginTop: 6 }}>
          <div className="rows">
            {state.routes.map((route) => {
              const data = outlooks[route.id]
              const best = data ? bestOfWeek(data.week) : null
              const score = best?.best?.score ?? null
              const verdict = score === null ? null : verdictOf(score)

              return (
                <div
                  key={route.id}
                  className="row row--tap"
                  data-tone={verdict ?? 'none'}
                  data-active={route.id === activeRoute?.id}
                  onClick={() => onPick(route.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && onPick(route.id)}
                  style={{ alignItems: 'flex-start', paddingTop: 12, paddingBottom: 12 }}
                >
                  {/* Skóre vlevo jako v tabulce výsledků — trasy se tak dají
                      porovnat jedním sjetím očí dolů. */}
                  <div style={{ width: 46, flexShrink: 0 }}>
                    <div
                      className="mono"
                      style={{ fontSize: 22, fontWeight: 600, lineHeight: 1, color: 'var(--tone)' }}
                    >
                      {score ?? '··'}
                    </div>
                    <div className="label" style={{ fontSize: 9, color: 'var(--tone)', marginTop: 3 }}>
                      {verdict ? WORD[verdict] : 'čekám'}
                    </div>
                  </div>

                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                      <span
                        className="truncate"
                        style={{ fontSize: 15.5, fontWeight: 600, letterSpacing: '-0.005em' }}
                      >
                        {route.name || 'Bez názvu'}
                      </span>
                      {route.id === DEMO_ROUTE_ID && <span className="tag">ukázka</span>}
                    </div>

                    <div style={{ margin: '8px 0 7px' }}>
                      {score === null ? (
                        <div className="skel" style={{ height: 5 }} />
                      ) : (
                        <Gauge score={score} />
                      )}
                    </div>

                    <div className="footnote truncate">
                      {data
                        ? `${km(data.track.lengthKm)} · ↑ ${metres(data.track.ascentM)}`
                        : `${bodu(route.waypoints.length)} · počítám…`}
                    </div>
                    {best?.best && (
                      <div className="footnote truncate">
                        {dayShort(parseDay(best.date))} {clock(best.best.start)}–
                        {clock(best.best.endsAt)} ·{' '}
                        {formatDuration((best.best.endsAt.getTime() - best.best.start.getTime()) / 60000)}
                      </div>
                    )}
                  </div>

                  <button
                    className="btn-icon"
                    aria-label={`Upravit ${route.name || 'trasu'}`}
                    style={{ width: 34, height: 34, marginTop: -2 }}
                    onClick={(e) => {
                      e.stopPropagation()
                      onEdit(route)
                    }}
                  >
                    <Icon name="edit" size={17} />
                  </button>
                </div>
              )
            })}
          </div>

          <button className="btn btn--ghost" style={{ marginTop: 16 }} onClick={onNew}>
            <Icon name="plus" size={17} stroke={2} />
            Nová trasa
          </button>
        </div>
      )}
    </div>
  )
}
