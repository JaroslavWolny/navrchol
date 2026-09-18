import { verdictOf, type Verdict } from '../lib/score'

/** Hranice, na kterých se láme verdikt. Na stupnici jsou vidět jako zářezy. */
const THRESHOLDS = [35, 65]

interface Props {
  score: number
  /** Verdikt se normálně odvodí ze skóre; tvrdý zákaz ho ale může přebít. */
  tone?: Verdict
  /** Popisky stupnice. Jen tam, kde se podle ní rozhoduje. */
  scale?: boolean
  size?: 'lg' | 'sm'
}

/**
 * Jediný přístroj v appce: hodnota na pevné stupnici 0—100 se zářezy v místech,
 * kde se láme verdikt. Samotné číslo neřekne, jak blízko je k hranici — proto
 * se skóre nikde neukazuje bez téhle stupnice pod sebou.
 */
export function Gauge({ score, tone, scale = false, size = 'sm' }: Props) {
  return (
    <div className={size === 'lg' ? 'gauge' : 'gauge gauge--sm'} data-tone={tone ?? verdictOf(score)}>
      <div className="gauge-track">
        <div className="gauge-fill" style={{ width: `${Math.max(1.5, score)}%` }} />
        {THRESHOLDS.map((t) => (
          <span key={t} className="gauge-notch" style={{ left: `${t}%` }} />
        ))}
      </div>
      {scale && (
        <div className="gauge-scale" aria-hidden="true">
          <span style={{ left: 0 }}>0</span>
          {THRESHOLDS.map((t) => (
            <span key={t} style={{ left: `${t}%` }}>
              {t}
            </span>
          ))}
          <span style={{ left: '100%' }}>100</span>
        </div>
      )}
    </div>
  )
}
