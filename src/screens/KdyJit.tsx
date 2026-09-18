import { Scroll } from '../components/Scroll'
import { Section } from '../components/Section'
import { Empty, ErrorState, Loading } from '../components/States'
import { verdictOf } from '../lib/score'
import { clock, dayShort, parseDay } from '../lib/format'
import type { DayOutlook } from '../lib/plan'
import type { RouteData } from '../state/useRouteData'
import type { Route } from '../lib/types'

/** Jistota klesá s tím, jak daleko do budoucna se díváme. Bledší pruh = míň jistoty. */
const confidenceOf = (dayIndex: number) => Math.max(0.42, 1 - dayIndex * 0.1)

interface Props {
  route: Route | null
  data: RouteData
  week: DayOutlook[] | null
  onPickStart: (start: Date) => void
}

export function KdyJitScreen({ route, data, week, onPickStart }: Props) {
  if (!route || route.waypoints.length < 2) {
    return (
      <div className="scroll">
        <Empty title="Žádná trasa" hint="Vyber trasu, pak ti řeknu, kdy přesně na ni vyrazit." />
      </div>
    )
  }
  if (data.error) return <div className="scroll"><ErrorState message={data.error} onRetry={data.reload} /></div>
  if (!week) return <div className="scroll"><Loading what="procházím všechny hodiny v týdnu" /></div>

  const usable = week.filter((d) => d.best)
  const best = usable.length ? usable.reduce((a, b) => (b.best!.score > a.best!.score ? b : a)) : null

  return (
    <Scroll onRefresh={data.reload} refreshing={data.loading}>
      <header className="masthead">
        <h1>Kdy jít</h1>
        <div className="meta">{route.name} · 7 dní po hodinách</div>
      </header>

      <div className="sec" style={{ marginTop: 18 }}>
        {best?.best ? (
          <button
            className="pick"
            data-tone={verdictOf(best.best.score)}
            onClick={() => onPickStart(best.best!.start)}
          >
            <div className="pick-head">
              <div>
                <div className="label" style={{ color: 'var(--tone)' }}>
                  Nejlepší okno
                </div>
                <div className="pick-when">
                  {dayShort(parseDay(best.date))} · {clock(best.best.start)}–{clock(best.best.endsAt)}
                </div>
              </div>
              <div className="pick-score">{best.best.score}</div>
            </div>
            <div className="hint" style={{ marginTop: 6 }}>
              Ťukni a verdikt se přepne na tenhle termín.
            </div>
          </button>
        ) : (
          <div className="note">
            Tenhle týden nevychází žádné použitelné okno — trasa se nevejde mezi východ a západ
            slunce, nebo jsou podmínky mimo celou dobu.
          </div>
        )}
      </div>

      <Section label="Skóre podle hodiny startu" meta="0—6—12—18—24 h">
        <div className="rows">
          {week.map((day, dayIndex) => {
            const isBest = best?.date === day.date
            const score = day.best?.score ?? null
            const alpha = confidenceOf(dayIndex)
            return (
              <button
                key={day.date}
                className="row row--tap"
                onClick={() => day.best && onPickStart(day.best.start)}
                data-tone={score === null ? 'none' : verdictOf(score)}
              >
                <span
                  className="mono"
                  style={{
                    width: 48,
                    flexShrink: 0,
                    fontSize: 11.5,
                    fontWeight: isBest ? 600 : 400,
                    color: isBest ? 'var(--paper)' : 'var(--paper-3)',
                  }}
                >
                  {dayShort(parseDay(day.date))}
                </span>
                <span className="day-bars">
                  {day.hourly.map((s, h) => (
                    <span
                      key={h}
                      data-tone={s === null ? undefined : verdictOf(s)}
                      style={{
                        height: s === null ? 6 : 8 + (s / 100) * 18,
                        background: s === null ? 'var(--rule-soft)' : 'var(--tone)',
                        opacity: s === null ? 1 : alpha,
                      }}
                    />
                  ))}
                </span>
                <span
                  className="row-value"
                  style={{ width: 26, textAlign: 'right', color: score === null ? 'var(--paper-4)' : 'var(--tone)' }}
                >
                  {score ?? '—'}
                </span>
              </button>
            )
          })}
        </div>

        <div className="legend" style={{ marginTop: 14 }}>
          {(['jdi', 'zvaz', 'nejdi'] as const).map((t) => (
            <span key={t} data-tone={t}>
              <i style={{ background: 'var(--tone)' }} />
              {t === 'zvaz' ? 'zvaž' : t}
            </span>
          ))}
          <span>
            <i style={{ background: 'var(--rule-soft)' }} />
            mimo světlo
          </span>
        </div>

        <p className="footnote" style={{ marginTop: 10 }}>
          Sytost barvy = jistota předpovědi. Čím vzdálenější den, tím je pruh bledší.
        </p>
      </Section>
    </Scroll>
  )
}
