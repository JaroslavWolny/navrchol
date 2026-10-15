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

const WORD = { jdi: 'Jdi', zvaz: 'Zvaž', nejdi: 'Nejdi' } as const

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
    <Screen title="Kdy jít" subtitle={route.name} onRefresh={data.reload} refreshing={data.loading && Boolean(week)}>
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
      <div className="page mt-12">
        {best?.best ? (
          <button
            className="card verdict"
            data-tone={verdictOf(best.best.score)}
            style={{ display: 'block', width: '100%', textAlign: 'left' }}
            onClick={() => onPickStart(best.best!.start)}
          >
            <div className="t-foot muted" style={{ fontWeight: 600 }}>
              Nejlepší start v týdnu
            </div>
            <div className="verdict-top mt-4">
              <div>
                <div className="t-title">
                  {capital(dayLabel(best.best.start))}, {clock(best.best.start)}
                </div>
                <div className="t-sub muted mt-4">
                  Návrat {clock(best.best.endsAt)} · {duration((best.best.endsAt.getTime() - best.best.start.getTime()) / 60000)}
                </div>
              </div>
              <div className="score">
                <b style={{ color: 'var(--tone)' }}>{best.best.score}</b>
                <span>{WORD[verdictOf(best.best.score)]}</span>
              </div>
            </div>
            <div className="row mt-12 link t-sub" style={{ color: 'var(--accent)' }}>
              Naplánovat na tenhle čas
              <Icon name="chevron" size={15} stroke={2.4} />
            </div>
          </button>
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
        <div className="card card-pad" style={{ margin: '0 var(--g)' }}>
          <Heatmap week={week} picked={start} onPick={onPickStart} />
          <div className="legend mt-12">
            <span data-tone="jdi">
              <i />
              jdi
            </span>
            <span data-tone="zvaz">
              <i />
              zvaž
            </span>
            <span data-tone="nejdi">
              <i />
              nejdi
            </span>
            <span>
              <i style={{ background: 'var(--fill-2)' }} />
              nevychází
            </span>
          </div>
        </div>
      </Section>

      {summit && data.forecast && (
        <Section
          title="Na vrcholu"
          aside={<span className="aside">{metres(summit.site.elevation)}</span>}
          footer={vlna(
            'Šedá je oblačnost v dané výšce, čím tmavší, tím hustší. Když přetne čárkovanou výšku vrcholu, budeš nahoře v mraku. Vítr je dorovnaný na hřeben, nárazy a srážky jsou z nepříznivé strany ansámblu jako ve verdiktu.',
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
                title={capital(dayLabel(date))}
                sub={
                  d.best
                    ? `start ${clock(d.best.start)}, návrat ${clock(d.best.endsAt)}`
                    : 'trasa se za světla nestihne'
                }
                onClick={d.best ? () => onPickStart(d.best!.start) : undefined}
                chevron={Boolean(d.best)}
              >
                {score !== null && (
                  <span className="badge" data-tone={verdictOf(score)}>
                    {score}
                  </span>
                )}
              </Cell>
            )
          })}
        </div>
      </Section>
    </>,
  )
}
