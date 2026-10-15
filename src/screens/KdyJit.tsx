import { Heatmap } from '../components/Heatmap'
import { Icon } from '../components/Icon'
import { Meteogram } from '../components/Meteogram'
import { Screen } from '../components/Screen'
import { Cell, Section } from '../components/ui'
import { Empty, ErrorState, Loading } from '../components/States'
import { verdictOf } from '../lib/score'
import { capital, clock, dayLabel, duration, metres, parseDay, vlna } from '../lib/format'
import { summitHours, type DayOutlook } from '../lib/plan'
import type { RouteData } from '../state/useRouteData'
import type { Route } from '../lib/types'

const WORD = { jdi: 'jdi', zvaz: 'zvaž', nejdi: 'nejdi' } as const

interface Props {
  route: Route | null
  data: RouteData
  week: DayOutlook[] | null
  start: Date
  onPickStart: (start: Date) => void
}

export function KdyJitScreen({ route, data, week, start, onPickStart }: Props) {
  if (!route || route.waypoints.length < 2) {
    return (
      <Screen title="Kdy jít">
        <Empty icon="kdy" title="Žádná trasa" hint="Vyber trasu a appka projde každou hodinu startu na týden dopředu." />
      </Screen>
    )
  }

  const shell = (children: React.ReactNode) => (
    <Screen title="Kdy jít" subtitle={`${route.name} · ${week?.length ?? 7} dní`} onRefresh={data.reload} refreshing={data.loading && Boolean(week)}>
      {children}
    </Screen>
  )

  if (data.error) return shell(<ErrorState message={data.error} onRetry={data.reload} />)
  if (!week) return shell(<Loading what="Procházím každou hodinu startu v týdnu" />)

  const summit = data.track && data.forecast ? summitHours(data.track, data.forecast) : null
  const usable = week.filter((d) => d.best)
  const best = usable.length ? usable.reduce((a, b) => (b.best!.score > a.best!.score ? b : a)) : null

  return shell(
    <>
      <div className="page" style={{ marginTop: 20 }}>
        {best?.best ? (
          <section className="best" aria-label="Nejlepší start">
            <div className="between" style={{ alignItems: 'flex-start' }}>
              <div className="stack" style={{ gap: 8 }}>
                <span className="label" style={{ color: 'var(--go)' }}>
                  Nejlepší start v týdnu
                </span>
                <span className="best-when">
                  {capital(dayLabel(best.best.start))}, {clock(best.best.start)}
                </span>
                <span className="mono" style={{ fontSize: 12, color: 'var(--on-ink-2)' }}>
                  Návrat {clock(best.best.endsAt)} · {duration((best.best.endsAt.getTime() - best.best.start.getTime()) / 60000)}
                </span>
              </div>
              <span className="score-tile score-tile--lg" data-tone={verdictOf(best.best.score)}>
                <b>{best.best.score}</b>
                <span>{WORD[verdictOf(best.best.score)]}</span>
              </span>
            </div>
            <button className="best-go" onClick={() => onPickStart(best.best!.start)}>
              Naplánovat na tenhle čas
              <span aria-hidden="true">
                <Icon name="arrowRight" size={18} stroke={2.2} />
              </span>
            </button>
          </section>
        ) : (
          <div className="card card-pad t-callout muted">
            Tenhle týden trasa nevychází. Buď se nevejde mezi východ a západ slunce, nebo je počasí mimo po celou dobu.
          </div>
        )}
      </div>

      <Section
        title="Podle hodiny startu"
        footer="Každé políčko je celá túra při startu v danou hodinu, včetně cesty zpátky a pauzy. Prázdná políčka jsou starty, které by skončily po setmění nebo už proběhly. Vzdálenější dny jsou méně jisté."
      >
        <div className="card" style={{ margin: '0 var(--g)', padding: '16px 14px' }}>
          <Heatmap week={week} picked={start} onPick={onPickStart} />
          <div className="legend">
            <span>
              <i style={{ background: 'var(--go)' }} />
              jdi
            </span>
            <span>
              <i style={{ background: 'var(--warn)' }} />
              zvaž
            </span>
            <span>
              <i style={{ background: 'repeating-linear-gradient(135deg, var(--stop) 0 2px, var(--stop-soft) 2px 4px)' }} />
              nejdi
            </span>
            <span>
              <i style={{ background: 'var(--sunk)' }} />
              nevychází
            </span>
            <span className="end">
              <i style={{ background: 'none', boxShadow: 'inset 0 0 0 2px var(--ink)' }} />
              nejlepší
            </span>
          </div>
        </div>
      </Section>

      {summit && data.forecast && (
        <Section
          title="Na vrcholu"
          aside={<span className="aside">{metres(summit.site.elevation)}</span>}
          footer={vlna(
            'Šedá je oblačnost v dané výšce, čím tmavší, tím hustší. Až přetne čárkovanou výšku vrcholu, budeš nahoře v mraku. Vítr je dorovnaný na hřeben, nárazy a srážky jsou z nepříznivé strany ansámblu jako ve verdiktu.',
          )}
        >
          <div className="card card-pad" style={{ margin: '0 var(--g)' }}>
            <Meteogram hours={summit.hours} days={data.forecast.days} elevation={summit.site.elevation} />
          </div>
        </Section>
      )}

      <Section title="Po dnech">
        <div className="list">
          {week.map((d) => {
            const date = parseDay(d.date)
            const score = d.best?.score ?? null
            return (
              <Cell
                key={d.date}
                title={<span style={{ fontSize: 16 }}>{capital(dayLabel(date))}</span>}
                sub={
                  <span className="mono" style={{ fontSize: 11.5 }}>
                    {d.best ? `start ${clock(d.best.start)} · návrat ${clock(d.best.endsAt)}` : 'trasa se za světla nestihne'}
                  </span>
                }
                onClick={d.best ? () => onPickStart(d.best!.start) : undefined}
                chevron={Boolean(d.best)}
                style={{ minHeight: 64 }}
              >
                <span className="badge badge--md" data-tone={score === null ? 'none' : verdictOf(score)}>
                  {score ?? '—'}
                </span>
              </Cell>
            )
          })}
        </div>
      </Section>
    </>,
  )
}
