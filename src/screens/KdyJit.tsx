import { Empty, ErrorState, Loading } from '../components/States'
import { verdictOf } from '../lib/score'
import { clock, dayShort, parseDay } from '../lib/format'
import type { DayOutlook } from '../lib/plan'
import type { RouteData } from '../state/useRouteData'
import type { Route } from '../lib/types'

const COLOR = { jdi: 'var(--go)', zvaz: 'var(--warn)', nejdi: 'var(--stop)' }
const NIGHT = 'oklch(0.255 0.016 255)'

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
  if (!week) return <div className="scroll"><Loading what="Procházím všechny hodiny v týdnu…" /></div>

  const usable = week.filter((d) => d.best)
  const best = usable.length ? usable.reduce((a, b) => (b.best!.score > a.best!.score ? b : a)) : null

  return (
    <div className="scroll">
      <div className="pad" style={{ paddingTop: 22 }}>
        <h1 className="page-title">Kdy jít</h1>
        <div className="sub" style={{ marginTop: 6 }}>
          {route.name} · 7 dní po hodinách
        </div>
      </div>

      {best?.best ? (
        <div className="pad" style={{ marginTop: 14 }}>
          <button
            onClick={() => onPickStart(best.best!.start)}
            className="card"
            style={{
              width: '100%',
              textAlign: 'left',
              background: COLOR[verdictOf(best.best.score)] === COLOR.jdi ? 'var(--go-wash)' : 'var(--warn-wash)',
              borderRadius: 18,
              padding: '15px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 7,
            }}
          >
            <div className="row-between">
              <div className="stack" style={{ gap: 2 }}>
                <div
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    color: COLOR[verdictOf(best.best.score)],
                  }}
                >
                  NEJLEPŠÍ OKNO
                </div>
                <div className="disp" style={{ fontSize: 21, fontWeight: 800 }}>
                  {dayShort(parseDay(best.date))} · {clock(best.best.start)}–{clock(best.best.endsAt)}
                </div>
              </div>
              <div
                className="mono"
                style={{
                  fontSize: 34,
                  fontWeight: 700,
                  lineHeight: 1,
                  color: COLOR[verdictOf(best.best.score)],
                }}
              >
                {best.best.score}
              </div>
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.42, color: 'var(--dim)', textWrap: 'pretty' }}>
              Ťukni a přepne se verdikt na tenhle termín.
            </div>
          </button>
        </div>
      ) : (
        <div className="pad" style={{ marginTop: 14 }}>
          <div className="error-box" style={{ background: 'var(--card)' }}>
            Tenhle týden nevychází žádné použitelné okno — trasa se nevejde mezi východ a západ slunce,
            nebo jsou podmínky mimo celou dobu.
          </div>
        </div>
      )}

      <div className="pad" style={{ marginTop: 16 }}>
        <div className="row-between" style={{ alignItems: 'baseline', paddingBottom: 6 }}>
          <span className="section-label">SKÓRE PODLE HODINY STARTU</span>
          <span className="mono" style={{ fontSize: 10, color: 'var(--faint)' }}>0—6—12—18—24 h</span>
        </div>

        <div className="stack" style={{ gap: 4 }}>
          {week.map((day, dayIndex) => {
            const isBest = best?.date === day.date
            const score = day.best?.score ?? null
            const alpha = confidenceOf(dayIndex)
            return (
              <button
                key={day.date}
                onClick={() => day.best && onPickStart(day.best.start)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '7px 10px',
                  borderRadius: 12,
                  width: '100%',
                  background: isBest ? 'oklch(0.225 0.018 255)' : 'var(--card-2)',
                  border: isBest ? '1px solid oklch(0.45 0.09 152)' : '1px solid transparent',
                }}
              >
                <span
                  className="mono"
                  style={{ width: 46, fontSize: 11, fontWeight: 700, color: isBest ? 'var(--fg)' : 'var(--dim)', textAlign: 'left' }}
                >
                  {dayShort(parseDay(day.date))}
                </span>
                <span style={{ flexGrow: 1, display: 'flex', gap: 1.5, alignItems: 'flex-end', height: 26, minWidth: 0 }}>
                  {day.hourly.map((s, h) => (
                    <span
                      key={h}
                      style={{
                        flexGrow: 1,
                        flexBasis: 0,
                        height: s === null ? 7 : 9 + (s / 100) * 17,
                        borderRadius: 1.5,
                        background: s === null ? NIGHT : COLOR[verdictOf(s)],
                        opacity: s === null ? 1 : alpha,
                      }}
                    />
                  ))}
                </span>
                <span
                  className="mono"
                  style={{
                    width: 26,
                    textAlign: 'right',
                    fontSize: 15,
                    fontWeight: 700,
                    color: score === null ? 'var(--faint)' : COLOR[verdictOf(score)],
                  }}
                >
                  {score ?? '—'}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="pad" style={{ marginTop: 12, display: 'flex', gap: 14, alignItems: 'center' }}>
        {[
          ['var(--go)', 'jdi'],
          ['var(--warn)', 'zvaž'],
          ['var(--stop)', 'nejdi'],
          [NIGHT, 'mimo světlo'],
        ].map(([c, label]) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: c }} />
            <span className="mono" style={{ fontSize: 10, color: 'var(--mute)' }}>{label}</span>
          </span>
        ))}
      </div>
      <div className="pad mono" style={{ marginTop: 8, fontSize: 10, color: 'var(--faint)', lineHeight: 1.5 }}>
        Sytost barvy = jistota předpovědi. Čím vzdálenější den, tím je pruh bledší.
      </div>
    </div>
  )
}
