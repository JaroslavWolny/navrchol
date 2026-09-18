import { Icon } from '../components/Icon'
import { Empty } from '../components/States'
import { useAllOutlooks } from '../state/useRouteData'
import { formatDuration } from '../lib/pace'
import { verdictOf } from '../lib/score'
import { clock, dayShort, km, metres, parseDay } from '../lib/format'
import type { DayOutlook } from '../lib/plan'
import type { StoredState } from '../state/store'
import type { Route } from '../lib/types'

const TONE = {
  jdi: { color: 'var(--go)', wash: 'var(--go-wash)', word: 'JDI' },
  zvaz: { color: 'var(--warn)', wash: 'var(--warn-wash)', word: 'ZVAŽ' },
  nejdi: { color: 'var(--stop)', wash: 'var(--stop-wash)', word: 'NEJDI' },
}

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
}

export function TrasyScreen({ state, activeRoute, onPick, onNew, onEdit }: Props) {
  const outlooks = useAllOutlooks(state.routes)

  return (
    <div className="scroll">
      <div className="pad row-between" style={{ alignItems: 'flex-end', paddingTop: 20 }}>
        <div className="stack" style={{ gap: 7 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="peak" size={14} stroke={2.4} color="var(--acc)" />
            <span className="wordmark">NAVRCHOL</span>
          </div>
          <h1 className="page-title">Moje trasy</h1>
        </div>
        <button
          onClick={onNew}
          aria-label="Nová trasa"
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            background: 'var(--acc)',
            color: 'var(--acc-ink)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="plus" size={22} stroke={2.4} />
        </button>
      </div>

      {state.routes.length === 0 ? (
        <Empty
          title="Zatím žádná trasa"
          hint="Přidej první túru: naklikej body na mapě a nastav, kdy chceš vyrazit."
          action={{ label: 'Nová trasa', onClick: onNew }}
        />
      ) : (
        <div className="pad stack" style={{ gap: 10, marginTop: 16 }}>
          {state.routes.map((route) => {
            const data = outlooks[route.id]
            const best = data ? bestOfWeek(data.week) : null
            const score = best?.best?.score ?? null
            const tone = TONE[score === null ? 'zvaz' : verdictOf(score)]

            return (
              <div
                key={route.id}
                className="card"
                style={{
                  display: 'flex',
                  gap: 13,
                  outline:
                    route.id === activeRoute?.id ? '1px solid oklch(0.45 0.06 200)' : 'none',
                }}
                onClick={() => onPick(route.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onPick(route.id)}
              >
                <div
                  style={{
                    width: 58,
                    flexShrink: 0,
                    borderRadius: 12,
                    background: score === null ? 'var(--card-3)' : tone.wash,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1,
                  }}
                >
                  {score === null ? (
                    <div className="mono" style={{ fontSize: 18, color: 'var(--faint)' }}>
                      &middot;&middot;&middot;
                    </div>
                  ) : (
                    <>
                      <div
                        className="mono"
                        style={{ fontSize: 23, fontWeight: 700, lineHeight: 1, color: tone.color }}
                      >
                        {score}
                      </div>
                      <div
                        className="mono"
                        style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.12em', color: tone.color }}
                      >
                        {tone.word}
                      </div>
                    </>
                  )}
                </div>

                <div className="stack" style={{ gap: 5, flexGrow: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>
                    {route.name || 'Bez názvu'}
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--dim)' }}>
                    {data
                      ? `${km(data.track.lengthKm)} · ↑ ${metres(data.track.ascentM)}${
                          best?.best
                            ? ` · ${formatDuration(
                                (best.best.endsAt.getTime() - best.best.start.getTime()) / 60000,
                              )}`
                            : ''
                        }`
                      : `${route.waypoints.length} bodů · počítám…`}
                  </div>
                  {best?.best && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Icon name="clock" size={12} stroke={2.2} color={tone.color} />
                      <span style={{ fontSize: 12, fontWeight: 500, color: tone.color }}>
                        {dayShort(parseDay(best.date))} {clock(best.best.start)}–
                        {clock(best.best.endsAt)}
                      </span>
                    </div>
                  )}
                </div>

                <button
                  aria-label="Upravit trasu"
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit(route)
                  }}
                  style={{ color: 'var(--faint)', alignSelf: 'center', padding: 8 }}
                >
                  <Icon name="edit" size={18} />
                </button>
              </div>
            )
          })}

          <button className="btn btn-ghost" style={{ marginTop: 4 }} onClick={onNew}>
            <Icon name="plus" size={17} stroke={2} />
            Nová trasa
          </button>
        </div>
      )}
    </div>
  )
}
