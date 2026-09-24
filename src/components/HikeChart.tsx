import { useId } from 'react'
import { Icon, weatherColor, weatherIcon } from './Icon'
import { useWidth } from './useWidth'
import { verdictOf } from '../lib/score'
import { clock, deg } from '../lib/format'
import type { Assessment, Sample } from '../lib/plan'
import type { Track } from '../lib/routing'

const TONE = { jdi: 'var(--go)', zvaz: 'var(--mid-fill)', nejdi: 'var(--stop)' } as const

/** Výška řádků grafu. Řádek srážek se sbalí, když na celé túře neprší. */
const ICON_Y = 0
const TEMP_Y = 38
const PROFILE_TOP = 50
const PROFILE_BOTTOM = 150
const RAIN_TOP = 158
const RAIN_H = 22
const MIN_COL = 34
/** Pod desetinu milimetru to není déšť, jen šum kvantilu. */
const WET = 0.1

/**
 * Průběh túry: výškový profil v čase, ne ve vzdálenosti. Pauza nahoře je
 * vidět jako rovinka, sestup jako rychlejší spád — a nad každou hodinou je
 * počasí přesně tam, kde v tu hodinu podle tempa budeš. Čára profilu má
 * barvu skóre dané hodiny.
 */
export function HikeChart({ assessment, track }: { assessment: Assessment; track: Track }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const gradient = useId()
  const { samples, start, end, plan } = assessment
  const total = end.getTime() - start.getTime()
  if (samples.length < 2 || total <= 0 || plan.elapsed.length !== track.points.length) {
    return <div ref={ref} />
  }

  const W = width
  const x = (t: number) => ((t - start.getTime()) / total) * W
  const tOf = (i: number) => start.getTime() + plan.elapsed[i] * 60000

  const elevations = track.points.map((p) => p.elevation)
  const lo = Math.min(...elevations)
  const hi = Math.max(...elevations)
  const pad = Math.max(20, (hi - lo) * 0.08)
  const yLo = lo - pad
  const yHi = hi + pad * 0.6
  const y = (e: number) => PROFILE_BOTTOM - ((e - yLo) / Math.max(1, yHi - yLo)) * (PROFILE_BOTTOM - PROFILE_TOP)

  // Body trati do cesty; bod blíž než půl pixelu k předchozímu nic nepřidá.
  const pts: Array<{ x: number; y: number; t: number }> = []
  track.points.forEach((p, i) => {
    const px = x(tOf(i))
    if (pts.length === 0 || px - pts[pts.length - 1].x >= 0.5 || i === track.points.length - 1) {
      pts.push({ x: px, y: y(p.elevation), t: tOf(i) })
    }
  })
  const line = (list: typeof pts) =>
    list.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('')
  const area = `${line(pts)}L${W} ${PROFILE_BOTTOM}L0 ${PROFILE_BOTTOM}Z`

  // Úseky čáry podle hodin: každý v barvě horšího skóre na svých koncích.
  const segments = samples.slice(0, -1).map((s, i) => {
    const next = samples[i + 1]
    const a = s.at.getTime()
    const b = next.at.getTime()
    const inside = pts.filter((p) => p.t >= a && p.t <= b)
    const before = [...pts].reverse().find((p) => p.t < a)
    const after = pts.find((p) => p.t > b)
    const list = [...(before ? [before] : []), ...inside, ...(after ? [after] : [])]
    return { key: a, d: line(list), tone: verdictOf(Math.min(s.score, next.score)) }
  })

  const columns = pickColumns(samples, x, W)

  // Značky na profilu: body trasy a nejvyšší místo.
  const marks = assessment.passes.map((p, i) => {
    const idx = track.waypointIndices[i] ?? 0
    return { x: x(p.at.getTime()), y: y(track.points[idx]?.elevation ?? lo), key: `${p.waypoint.id}-${i}` }
  })

  // Svislé značky: západ slunce, začátek bouřek, nejpozdější obrat.
  const vlines: Array<{ x: number; label: string; color: string }> = []
  const within = (d: Date | null | undefined) => d && d.getTime() > start.getTime() && d.getTime() < end.getTime()
  if (within(assessment.sunset)) vlines.push({ x: x(assessment.sunset!.getTime()), label: 'západ', color: 'var(--sun)' })
  if (assessment.storm && within(assessment.storm.turnaround)) {
    vlines.push({ x: x(assessment.storm.turnaround.getTime()), label: 'obrat', color: 'var(--mid-fill)' })
  }
  if (assessment.storm && within(assessment.storm.from)) {
    vlines.push({ x: x(assessment.storm.from.getTime()), label: 'bouřky', color: 'var(--stop)' })
  }

  // Vodorovné čáry: hranice lesa a nulová izoterma, jen když protínají profil.
  // Popisek jde na tu stranu, kde je čára od profilu nejdál.
  const labelSide = (level: number): 'start' | 'end' => {
    const cross = pts.filter((p, i) => i > 0 && (pts[i - 1].y - y(level)) * (p.y - y(level)) <= 0).map((p) => p.x)
    if (cross.length === 0) return 'end'
    return Math.min(...cross) > W - Math.max(...cross) ? 'start' : 'end'
  }
  const hlines: Array<{ y: number; label: string; color: string; side: 'start' | 'end' }> = []
  const freezing = samples.map((s) => s.hour.freezingLevel).filter((f): f is number => f !== null)
  const freezeLow = freezing.length ? Math.min(...freezing) : null
  if (freezeLow !== null && freezeLow > lo && freezeLow < hi) {
    hlines.push({ y: y(freezeLow), label: `0 °C`, color: 'var(--cold)', side: labelSide(freezeLow) })
  }

  const maxRain = Math.max(1, ...samples.map((s) => s.hour.precipitationRisk))
  const rainy = samples.some((s) => s.hour.precipitationRisk >= WET)
  const GUST_Y = rainy ? 196 : 170
  const TIME_Y = GUST_Y + 20
  const HEIGHT = TIME_Y + 6

  return (
    <div ref={ref}>
      <svg
        className="chart"
        width={W}
        height={HEIGHT}
        viewBox={`0 0 ${W} ${HEIGHT}`}
        role="img"
        aria-label="Průběh túry: výškový profil v čase s počasím po hodinách"
      >
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--terrain)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="var(--terrain)" stopOpacity="0.25" />
          </linearGradient>
        </defs>

        {hlines.map((l) => (
          <g key={l.label}>
            <line x1={0} x2={W} y1={l.y} y2={l.y} stroke={l.color} strokeWidth="1" strokeDasharray="3 3" opacity="0.7" />
            <text x={l.side === 'end' ? W - 2 : 2} y={l.y - 4} textAnchor={l.side} className="axis" style={{ fill: l.color }}>
              {l.label}
            </text>
          </g>
        ))}

        <path d={area} fill={`url(#${gradient})`} />
        {segments.map((s) => (
          <path
            key={s.key}
            d={s.d}
            fill="none"
            stroke={TONE[s.tone]}
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {vlines.map((l) => (
          <g key={l.label}>
            <line
              x1={l.x}
              x2={l.x}
              y1={PROFILE_TOP - 4}
              y2={PROFILE_BOTTOM}
              stroke={l.color}
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
            <text
              x={l.x + (l.x > W - 60 ? -4 : 4)}
              y={PROFILE_BOTTOM - 6}
              textAnchor={l.x > W - 60 ? 'end' : 'start'}
              className="axis"
              style={{ fill: l.color, fontWeight: 600 }}
            >
              {l.label}
            </text>
          </g>
        ))}

        {marks.map((m) => (
          <circle key={m.key} cx={m.x} cy={m.y} r="3.5" fill="var(--card)" stroke="var(--ink)" strokeWidth="1.8" />
        ))}

        {columns.map(({ sample: s, x: cx, anchor }) => {
          const icon = weatherIcon(s.hour)
          const gust = Math.round(s.hour.windGustsRisk)
          const rain = s.hour.precipitationRisk
          const barH = rain < WET ? 0 : Math.max(3, (rain / maxRain) * RAIN_H)
          const iconX = Math.min(W - 20, Math.max(0, cx - 10))
          const textX = anchor === 'start' ? 0 : anchor === 'end' ? W : cx
          return (
            <g key={s.at.getTime()}>
              <g transform={`translate(${iconX} ${ICON_Y})`}>
                <Icon name={icon} size={20} stroke={1.8} color={weatherColor(icon)} />
              </g>
              <text x={textX} y={TEMP_Y} textAnchor={anchor} className="val">
                {deg(s.hour.temperature)}
              </text>
              {barH > 0 && (
                <rect
                  x={Math.min(W - 10, Math.max(0, cx - 5))}
                  y={RAIN_TOP + RAIN_H - barH}
                  width="10"
                  height={barH}
                  rx="2"
                  fill="var(--rain)"
                  opacity={0.35 + 0.65 * Math.min(1, s.hour.precipitationProbability / 100)}
                />
              )}
              <text
                x={textX}
                y={GUST_Y}
                textAnchor={anchor}
                className="val-2"
                style={gust >= 50 ? { fill: gust >= 70 ? 'var(--stop)' : 'var(--mid)', fontWeight: 700 } : undefined}
              >
                {gust}
              </text>
              <text x={textX} y={TIME_Y} textAnchor={anchor} className="axis">
                {clock(s.at)}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="legend mt-8">
        <span>
          <Icon name="thermo" size={14} color="var(--ink-3)" />
          teplota
        </span>
        {rainy && (
          <span>
            <i style={{ background: 'var(--rain)' }} />
            srážky
          </span>
        )}
        <span>
          <Icon name="wind" size={14} color="var(--ink-3)" />
          nárazy km/h
        </span>
      </div>
    </div>
  )
}

/**
 * Které hodiny dostanou vlastní sloupec. Start a návrat vždycky, mezi nimi
 * celé hodiny tak husto, jak se vejdou — u dlouhé túry každá druhá.
 */
function pickColumns(samples: Sample[], x: (t: number) => number, W: number) {
  const out: Array<{ sample: Sample; x: number; anchor: 'start' | 'middle' | 'end' }> = []
  const first = samples[0]
  const last = samples[samples.length - 1]
  out.push({ sample: first, x: 0, anchor: 'start' })
  const lastX = W
  for (let i = 1; i < samples.length - 1; i++) {
    const cx = x(samples[i].at.getTime())
    // Krajní popisky jsou zarovnané k okraji, takže zabírají celou svou šířku dovnitř.
    const prev = out[out.length - 1]
    const gap = prev.anchor === 'start' ? MIN_COL + 22 : MIN_COL
    if (cx - prev.x < gap) continue
    if (lastX - cx < MIN_COL + 22) continue
    out.push({ sample: samples[i], x: cx, anchor: 'middle' })
  }
  out.push({ sample: last, x: lastX, anchor: 'end' })
  return out
}
