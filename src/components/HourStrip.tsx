import { verdictOf } from '../lib/score'
import { clock } from '../lib/format'
import type { Assessment } from '../lib/plan'

/**
 * Časová osa túry na kartě verdiktu: start (čtverec), vrchol (čtverec
 * s trojúhelníkem) na místě podle času a návrat (kolečko). Pás mezi nimi
 * je po hodinách a každý díl má barvu skóre té hodiny — na první pohled
 * je vidět, jestli se kazí ráno, na hřebeni, nebo až odpoledne na sestupu.
 */
export function HourStrip({ assessment, roundTrip }: { assessment: Assessment; roundTrip: boolean }) {
  const { samples, start, end } = assessment
  const total = end.getTime() - start.getTime()
  if (samples.length < 2 || total <= 0) return null

  const parts = samples.slice(0, -1).map((s, i) => {
    const next = samples[i + 1]
    const minutes = (next.at.getTime() - s.at.getTime()) / 60000
    // Úsek nese horší ze skóre na svých koncích — na hranici hodin se počasí nemění skokem.
    return { minutes, score: Math.min(s.score, next.score), key: s.at.getTime() }
  })

  // Nejvyšší bod trasy jako záchytný bod uprostřed osy.
  const top = [...assessment.passes].sort((a, b) => b.waypoint.elevation - a.waypoint.elevation)[0]
  const topAt = top && top.at > start && top.at < end ? top : null
  const topFrac = topAt ? (topAt.at.getTime() - start.getTime()) / total : 0
  const showTop = topAt !== null && topFrac > 0.2 && topFrac < 0.8

  return (
    <div className="timeline">
      <div className="strip" role="img" aria-label="Skóre po hodinách túry">
        {parts.map((p) => (
          <i key={p.key} data-tone={verdictOf(p.score)} style={{ flex: `${p.minutes} 1 0` }} />
        ))}
      </div>
      <span className="tl-mark" style={{ left: 0 }} />
      {showTop && (
        <span className="tl-mark tl-mark--top" style={{ left: `${topFrac * 100}%` }}>
          <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 4 22 20H2z" fill="var(--go)" />
          </svg>
        </span>
      )}
      <span className="tl-mark tl-mark--end" style={{ right: 0 }} />
      <div className="strip-labels">
        <span style={{ left: 0 }}>
          <b>{clock(start)}</b>
          <small>Start</small>
        </span>
        {showTop && (
          <span style={{ left: `${topFrac * 100}%`, transform: 'translateX(-50%)', alignItems: 'center' }}>
            <b>{clock(topAt.at)}</b>
            <small className="truncate" style={{ maxWidth: 140 }}>
              {topAt.waypoint.name}
            </small>
          </span>
        )}
        <span style={{ right: 0, alignItems: 'flex-end' }}>
          <b>{clock(end)}</b>
          <small>{roundTrip ? 'Návrat' : 'Cíl'}</small>
        </span>
      </div>
    </div>
  )
}
