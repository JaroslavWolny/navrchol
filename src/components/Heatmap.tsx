import { verdictOf } from '../lib/score'
import { capital, daysFromToday, parseDay, weekday } from '../lib/format'
import type { DayOutlook } from '../lib/plan'

/**
 * Barva políčka. Jdi je limetková se sytostí podle skóre — 66 a 95 jsou oba
 * „jdi", ale nejsou stejné. Nejdi je šrafované, aby se nedalo poznat jen
 * podle barvy; pod 25 body silněji.
 */
function cellBackground(s: number): string {
  const tone = verdictOf(s)
  if (tone === 'jdi') return `rgba(200, 241, 105, ${(0.32 + 0.68 * Math.min(1, (s - 60) / 36)).toFixed(2)})`
  if (tone === 'zvaz') return 'var(--warn)'
  return s < 25
    ? 'repeating-linear-gradient(135deg, #ff6b4e 0 3px, #ff8c74 3px 6px)'
    : 'repeating-linear-gradient(135deg, #ff9c88 0 3px, #ffc3b6 3px 6px)'
}

/**
 * Teplotní mapa startů: řádek = den, sloupec = hodina startu, barva = skóre
 * celé túry při startu v tu hodinu.
 */
export function Heatmap({
  week,
  picked,
  onPick,
}: {
  week: DayOutlook[]
  picked: Date | null
  onPick: (start: Date) => void
}) {
  const hours = new Set<number>()
  week.forEach((d) => d.hourly.forEach((s, h) => s !== null && hours.add(h)))
  if (hours.size === 0) return null
  const from = Math.min(...hours)
  const to = Math.max(...hours)
  const cols = Array.from({ length: to - from + 1 }, (_, i) => from + i)

  const best = week.reduce<{ date: string; hour: number; score: number } | null>((acc, d) => {
    d.hourly.forEach((s, h) => {
      if (s !== null && (!acc || s > acc.score)) acc = { date: d.date, hour: h, score: s }
    })
    return acc
  }, null)

  const pickedKey =
    picked &&
    `${picked.getFullYear()}-${String(picked.getMonth() + 1).padStart(2, '0')}-${String(picked.getDate()).padStart(2, '0')}|${picked.getHours()}`

  return (
    <div
      className="heat"
      style={{ gridTemplateColumns: `46px repeat(${cols.length}, minmax(0, 1fr))` }}
      role="grid"
      aria-label="Skóre podle dne a hodiny startu"
    >
      <span />
      {cols.map((h) => (
        <span key={h} className="heat-hd">
          {h % 2 === 0 || cols.length <= 8 ? h : ''}
        </span>
      ))}
      {week.map((d) => {
        const date = parseDay(d.date)
        const rel = daysFromToday(date)
        return [
          <span key={`${d.date}-l`} className="heat-day">
            {rel === 0 ? 'Dnes' : `${capital(weekday(date))} ${date.getDate()}.`}
          </span>,
          ...cols.map((h) => {
            const s = d.hourly[h]
            if (s === null || s === undefined) {
              return <span key={`${d.date}-${h}`} className="heat-cell" data-empty="true" />
            }
            const start = new Date(date)
            start.setHours(h, 0, 0, 0)
            return (
              <button
                key={`${d.date}-${h}`}
                className="heat-cell"
                data-tone={verdictOf(s)}
                data-best={best?.date === d.date && best.hour === h}
                data-picked={pickedKey === `${d.date}|${h}`}
                style={{ background: cellBackground(s) }}
                onClick={() => onPick(start)}
                aria-label={`${capital(weekday(date))} ${date.getDate()}. v ${h}:00, ${s} bodů`}
              />
            )
          }),
        ]
      })}
    </div>
  )
}
