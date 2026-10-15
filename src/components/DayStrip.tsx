import { verdictOf } from '../lib/score'
import { capital, daysFromToday, parseDay, weekday } from '../lib/format'

export interface DayChip {
  date: string
  /** Nejlepší skóre dne; null = ten den se trasa nedá stihnout za světla. */
  best: number | null
}

/**
 * Výběr dne jako v kalendáři: den v týdnu, datum a proužek v barvě nejlepšího
 * okna toho dne. Už z výběru je vidět, na který den se vyplatí dívat.
 */
export function DayStrip({
  days,
  selected,
  onSelect,
}: {
  days: DayChip[]
  selected: string
  onSelect: (date: string) => void
}) {
  return (
    <div className="days" role="group" aria-label="Den túry">
      {days.map((d) => {
        const date = parseDay(d.date)
        const rel = daysFromToday(date)
        const name = rel === 0 ? 'Dnes' : rel === 1 ? 'Zítra' : capital(weekday(date))
        return (
          <button
            key={d.date}
            className="day"
            aria-pressed={d.date === selected}
            data-empty={d.best === null}
            onClick={() => onSelect(d.date)}
            aria-label={`${name} ${date.getDate()}. ${date.getMonth() + 1}.${d.best === null ? ', nestihne se za světla' : `, nejlépe ${d.best} bodů`}`}
          >
            <span className="day-name">{name}</span>
            <span className="day-num">{date.getDate()}</span>
            <span className="day-bar" data-tone={d.best === null ? 'none' : verdictOf(d.best)} />
          </button>
        )
      })}
    </div>
  )
}
