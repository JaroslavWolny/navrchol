import { Icon, weatherIcon } from '../components/Icon'
import { Section } from '../components/Section'
import { Empty } from '../components/States'
import { haversine } from '../lib/geo'
import { bodu, clock, dayLabel, metres, temp } from '../lib/format'
import type { Assessment } from '../lib/plan'
import type { Track } from '../lib/routing'
import type { Route } from '../lib/types'

/** Kde jsi v danou hodinu a jaké tam je počasí. */
function hoursAlongRoute(a: Assessment) {
  const first = a.passes[0]
  const last = a.passes[a.passes.length - 1]
  if (!first || !last) return []

  const out: Array<{ at: Date; pass: (typeof a.passes)[number] }> = []
  const startHour = new Date(first.at)
  startHour.setMinutes(0, 0, 0)

  for (let t = startHour.getTime(); t <= last.at.getTime() + 3_600_000; t += 3_600_000) {
    const at = new Date(t)
    // Bod trasy, kterým v tuhle hodinu procházíš (nebo ten nejbližší).
    const pass = a.passes.reduce((best, p) =>
      Math.abs(p.at.getTime() - t) < Math.abs(best.at.getTime() - t) ? p : best,
    )
    out.push({ at, pass })
  }
  return out.slice(0, 9)
}

const W = 340
const H = 112

/** Výškový profil ze skutečné trati. */
function profilePath(track: Track): { line: string; area: string; marks: Array<{ x: number; y: number }> } {
  const pts = track.points
  if (pts.length < 2) return { line: '', area: '', marks: [] }

  const dist: number[] = [0]
  for (let i = 1; i < pts.length; i++) dist.push(dist[i - 1] + haversine(pts[i - 1], pts[i]))
  const total = dist[dist.length - 1] || 1

  const elevations = pts.map((p) => p.elevation)
  const lo = Math.min(...elevations)
  const hi = Math.max(...elevations)
  const span = Math.max(1, hi - lo)

  // Odsazení od kraje, ať se značka prvního a posledního bodu neusekne.
  const x = (i: number) => 5 + (dist[i] / total) * (W - 10)
  const y = (i: number) => H - 10 - ((elevations[i] - lo) / span) * (H - 24)

  const line = pts.map((_, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(i).toFixed(1)}`).join(' ')
  return {
    line,
    area: `${line} L${W - 5} ${H - 4} L5 ${H - 4} Z`,
    marks: track.waypointIndices.map((i) => ({ x: x(i), y: y(i) })),
  }
}

interface Props {
  route: Route | null
  track: Track | null
  assessment: Assessment | null
  onBack: () => void
}

export function TimelineScreen({ route, track, assessment, onBack }: Props) {
  if (!route || !assessment || !track || assessment.passes.length === 0) {
    return (
      <div className="app">
        <Topbar onBack={onBack} title="Počasí podél trasy" />
        <div className="scroll">
          <Empty title="Není co zobrazit" hint="Vrať se a vyber trasu s aspoň dvěma body." />
        </div>
      </div>
    )
  }

  const hours = hoursAlongRoute(assessment)
  const profile = profilePath(track)
  const worst = assessment.score.weakest
  const end = assessment.passes[assessment.passes.length - 1]
  const top = highestIndex(route)

  return (
    <div className="app">
      <Topbar onBack={onBack} title="Počasí podél trasy" />

      <div className="scroll">
        <Section
          label="Hodinu po hodině"
          meta={`${dayLabel(assessment.start)} ${clock(assessment.start)}→${clock(end.at)}`}
          tight
        >
          <div className="hours">
            {hours.map((h) => {
              const gust = h.pass.hour.windGusts
              return (
                <div className="hour-col" key={h.at.toISOString()}>
                  <span className="mono" style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--paper-3)' }}>
                    {clock(h.at)}
                  </span>
                  <Icon
                    name={weatherIcon(
                      h.pass.hour.precipitation,
                      h.pass.hour.cloudCover,
                      h.pass.hour.visibility,
                      h.pass.hour.temperature < 1,
                    )}
                    size={22}
                    stroke={1.6}
                    color={h.pass.hour.cloudCover < 25 ? 'var(--sun)' : 'var(--paper-2)'}
                    style={{ margin: '3px 0' }}
                  />
                  <span className="mono" style={{ fontSize: 14, fontWeight: 600 }}>
                    {temp(h.pass.hour.temperature).replace(' °C', '°')}
                  </span>
                  <span
                    className="mono"
                    data-tone={gust >= 70 ? 'nejdi' : gust >= 50 ? 'zvaz' : 'none'}
                    style={{
                      fontSize: 10.5,
                      color: gust >= 50 ? 'var(--tone)' : 'var(--paper-3)',
                    }}
                  >
                    {Math.round(gust)}
                  </span>
                  <span
                    style={{
                      width: 16,
                      height: Math.max(1, Math.min(14, h.pass.hour.precipitation * 8)),
                      background: 'var(--cold)',
                      marginTop: 2,
                    }}
                  />
                  <span className="mono" style={{ fontSize: 9, color: 'var(--paper-4)' }}>
                    {Math.round(h.pass.hour.precipitationProbability)}%
                  </span>
                </div>
              )
            })}
          </div>
          <p className="footnote" style={{ marginTop: 8 }}>
            teplota · nárazy v km/h · srážky a jejich pravděpodobnost
          </p>
        </Section>

        <Section label="Výškový profil" meta={`↑ ${metres(track.ascentM)} · ↓ ${metres(track.descentM)}`}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', width: '100%' }} aria-hidden="true">
            <defs>
              <linearGradient id="elev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--paper)" stopOpacity="0.16" />
                <stop offset="100%" stopColor="var(--paper)" stopOpacity="0.01" />
              </linearGradient>
            </defs>
            <path d={profile.area} fill="url(#elev)" />
            <path d={profile.line} fill="none" stroke="var(--paper)" strokeWidth="1.6" strokeLinejoin="miter" />
            {profile.marks.map((m, i) => (
              <rect
                key={i}
                x={m.x - (i === top ? 4 : 3)}
                y={m.y - (i === top ? 4 : 3)}
                width={i === top ? 8 : 6}
                height={i === top ? 8 : 6}
                fill={i === top ? 'var(--paper)' : 'var(--ground)'}
                stroke="var(--paper)"
                strokeWidth="1.5"
              />
            ))}
          </svg>
          <div className="footnote between" style={{ marginTop: 2 }}>
            <span>{metres(track.points[0]?.elevation ?? 0)}</span>
            <span>{metres(track.points[track.points.length - 1]?.elevation ?? 0)}</span>
          </div>
        </Section>

        {worst && (
          // Nejslabší místo existuje vždycky — i na skvělé trase. Výstražný tón
          // se proto rozsvítí až tam, kde se opravdu něco děje.
          <div className="sec" data-tone={worst.score < 35 ? 'nejdi' : worst.score < 65 ? 'zvaz' : 'none'}>
            <div className="note">
              {worst.score < 65 && <Icon name="warn" size={15} stroke={2} />}
              <div>
                <strong>Nejslabší místo: {worst.waypoint.name}</strong>
                <div style={{ marginTop: 3, color: 'var(--paper-2)' }}>
                  Budeš tam v{' '}
                  {clock(assessment.passes.find((p) => p.waypoint.id === worst.waypoint.id)?.at ?? assessment.start)},
                  skóre {worst.score} ze 100. {assessment.score.warnings[0]?.text ?? ''}
                </div>
              </div>
            </div>
          </div>
        )}

        <Section label="V bodech trasy" meta={bodu(assessment.passes.length)}>
          <div className="rows">
            {assessment.passes.map((p) => {
              const gust = p.hour.windGusts
              return (
                <div
                  className="row"
                  key={p.waypoint.id}
                  data-tone={gust >= 70 ? 'nejdi' : gust >= 50 ? 'zvaz' : 'none'}
                >
                  <span className="mono" style={{ width: 42, flexShrink: 0, fontSize: 12, color: 'var(--paper-3)' }}>
                    {clock(p.at)}
                  </span>
                  <span className="row-name truncate">{p.waypoint.name}</span>
                  <span className="row-value" style={{ fontSize: 13 }}>
                    {temp(p.hour.temperature)}
                  </span>
                  <span
                    className="row-value"
                    style={{ width: 62, textAlign: 'right', fontSize: 13, color: gust >= 50 ? 'var(--tone)' : 'var(--paper-2)' }}
                  >
                    {Math.round(gust)} km/h
                  </span>
                </div>
              )
            })}
          </div>
        </Section>

        <div className="sec">
          <p className="footnote">
            Shoda modelů {assessment.agreement} %
            {track.fallback ? ' · trať se nenačetla, počítáno vzdušnou čarou' : ''}
          </p>
        </div>
      </div>
    </div>
  )
}

const highestIndex = (route: Route) =>
  route.waypoints.reduce((best, w, i, arr) => (w.elevation > arr[best].elevation ? i : best), 0)

function Topbar({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <div className="topbar">
      <button className="btn-icon" onClick={onBack} aria-label="Zpět">
        <Icon name="back" size={20} stroke={2} />
      </button>
      <h1>{title}</h1>
    </div>
  )
}
