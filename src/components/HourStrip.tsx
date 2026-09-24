import { verdictOf } from '../lib/score'
import { clock } from '../lib/format'
import type { Assessment } from '../lib/plan'

/**
 * Pás hodin: celá túra od startu do návratu, každý díl je jedna hodina
 * a jeho barva je skóre té hodiny. Na první pohled je vidět, jestli se
 * kazí ráno, na hřebeni, nebo až odpoledne na sestupu.
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

  // Nejvyšší bod trasy jako záchytný bod uprostřed pásu.
  const top = [...assessment.passes].sort((a, b) => b.waypoint.elevation - a.waypoint.elevation)[0]
  const topAt = top && top.at > start && top.at < end ? top : null
  const topFrac = topAt ? (topAt.at.getTime() - start.getTime()) / total : 0
  const showTop = topAt !== null && topFrac > 0.2 && topFrac < 0.8

  return (
    <>
      <div className="strip" role="img" aria-label="Skóre po hodinách túry">
        {parts.map((p) => (
          <i key={p.key} data-tone={verdictOf(p.score)} style={{ flex: `${p.minutes} 1 0` }} />
        ))}
      </div>
      <div className="strip-labels">
        <span style={{ left: 0 }}>
          <b>{clock(start)}</b>start
        </span>
        {showTop && (
          <span style={{ left: `${topFrac * 100}%`, transform: 'translateX(-50%)', alignItems: 'center' }}>
            <b>{clock(topAt.at)}</b>
            <span className="truncate" style={{ maxWidth: 120 }}>{topAt.waypoint.name}</span>
          </span>
        )}
        <span style={{ right: 0, alignItems: 'flex-end' }}>
          <b>{clock(end)}</b>
          {roundTrip ? 'návrat' : 'cíl'}
        </span>
      </div>
    </>
  )
}
