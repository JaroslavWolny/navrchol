import { Icon, weatherIcon } from '../components/Icon'
import { Empty } from '../components/States'
import { haversine } from '../lib/geo'
import { clock, dayLabel, metres, temp } from '../lib/format'
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

const W = 338
const H = 118

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

  const x = (i: number) => (dist[i] / total) * W
  const y = (i: number) => H - 12 - ((elevations[i] - lo) / span) * (H - 26)

  const line = pts.map((_, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(i).toFixed(1)}`).join(' ')
  return {
    line,
    area: `${line} L${W} ${H - 6} L0 ${H - 6} Z`,
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
  if (!route || !assessment || !track) {
    return (
      <div className="app">
        <Header onBack={onBack} title="Počasí podél trasy" sub="" />
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

  return (
    <div className="app">
      <Header
        onBack={onBack}
        title="Počasí podél trasy"
        sub={`${dayLabel(assessment.start)} · ${clock(assessment.start)} → ${clock(end.at)}`}
      />

      <div className="scroll">
        <div className="pad">
          <div className="card" style={{ padding: '12px 10px 10px', display: 'flex', flexDirection: 'column', gap: 9 }}>
            <Strip>
              {hours.map((h) => (
                <Cell key={h.at.toISOString()}>
                  <span className="mono" style={{ fontSize: 11, fontWeight: 700 }}>{clock(h.at)}</span>
                </Cell>
              ))}
            </Strip>

            <Strip>
              {hours.map((h) => (
                <Cell key={h.at.toISOString()}>
                  <Icon
                    name={weatherIcon(
                      h.pass.hour.precipitation,
                      h.pass.hour.cloudCover,
                      h.pass.hour.visibility,
                      h.pass.hour.temperature < 1,
                    )}
                    size={24}
                    stroke={1.7}
                    color={h.pass.hour.cloudCover < 25 ? 'oklch(0.85 0.13 85)' : 'var(--dim)'}
                  />
                </Cell>
              ))}
            </Strip>

            <Strip>
              {hours.map((h) => (
                <Cell key={h.at.toISOString()}>
                  <span className="mono" style={{ fontSize: 15, fontWeight: 700 }}>
                    {temp(h.pass.hour.temperature).replace(' °C', '°')}
                  </span>
                </Cell>
              ))}
            </Strip>

            <Strip>
              {hours.map((h) => {
                const g = h.pass.hour.windGusts
                const color = g >= 70 ? 'var(--stop)' : g >= 50 ? 'var(--warn)' : 'var(--dim)'
                return (
                  <Cell key={h.at.toISOString()} column>
                    <Icon name="arrowUp" size={14} stroke={2.4} color={color} />
                    <span className="mono" style={{ fontSize: 11, fontWeight: 700, color }}>
                      {Math.round(g)}
                    </span>
                  </Cell>
                )
              })}
            </Strip>

            <Strip borderBottom>
              {hours.map((h) => (
                <Cell key={h.at.toISOString()} column bottom>
                  <div
                    style={{
                      width: 20,
                      height: Math.max(2, Math.min(16, h.pass.hour.precipitation * 8)),
                      borderRadius: 2,
                      background: 'oklch(0.70 0.10 230)',
                    }}
                  />
                  <span className="mono" style={{ fontSize: 9.5, color: 'var(--mute)' }}>
                    {Math.round(h.pass.hour.precipitationProbability)}%
                  </span>
                </Cell>
              ))}
            </Strip>

            <svg viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', width: '100%' }}>
              <defs>
                <linearGradient id="elev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--acc)" stopOpacity="0.34" />
                  <stop offset="100%" stopColor="var(--acc)" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <path d={profile.area} fill="url(#elev)" />
              <path d={profile.line} fill="none" stroke="var(--acc)" strokeWidth="2.2" strokeLinejoin="round" />
              {profile.marks.map((m, i) => (
                <circle
                  key={i}
                  cx={m.x}
                  cy={m.y}
                  r={i === highestIndex(route) ? 5.5 : 4}
                  fill={i === highestIndex(route) ? 'var(--acc)' : 'var(--card)'}
                  stroke="var(--acc)"
                  strokeWidth="2"
                />
              ))}
            </svg>
            <div className="mono" style={{ fontSize: 9.5, color: 'var(--mute)', display: 'flex', justifyContent: 'space-between' }}>
              <span>{metres(track.points[0]?.elevation ?? 0)}</span>
              <span>↑ {metres(track.ascentM)} · ↓ {metres(track.descentM)}</span>
              <span>{metres(track.points[track.points.length - 1]?.elevation ?? 0)}</span>
            </div>
          </div>
        </div>

        {worst && (
          <div className="pad" style={{ marginTop: 12 }}>
            <div
              style={{
                padding: '13px 14px',
                borderRadius: 14,
                background: worst.score < 35 ? 'var(--stop-wash)' : 'var(--warn-wash)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="warn" size={16} stroke={2.2} color={worst.score < 35 ? 'var(--stop)' : 'var(--warn)'} />
                <div style={{ fontSize: 13.5, fontWeight: 700, color: worst.score < 35 ? 'var(--stop)' : 'var(--warn)' }}>
                  Nejslabší místo: {worst.waypoint.name}
                </div>
              </div>
              <div style={{ fontSize: 12.5, lineHeight: 1.45, textWrap: 'pretty' }}>
                Budeš tam v {clock(assessment.passes.find((p) => p.waypoint.id === worst.waypoint.id)?.at ?? assessment.start)},
                skóre {worst.score} ze 100. {assessment.score.warnings[0]?.text ?? ''}
              </div>
            </div>
          </div>
        )}

        <div className="pad" style={{ marginTop: 12 }}>
          <div className="section-label" style={{ paddingBottom: 6 }}>V BODECH TRASY</div>
          <div className="stack" style={{ gap: 5 }}>
            {assessment.passes.map((p) => {
              const color = p.hour.windGusts >= 70 ? 'var(--stop)' : p.hour.windGusts >= 50 ? 'var(--warn)' : 'var(--fg)'
              return (
                <div key={p.waypoint.id} className="card-2" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--acc)', width: 42 }}>
                    {clock(p.at)}
                  </span>
                  <span style={{ flexGrow: 1, fontSize: 13, fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.waypoint.name}
                  </span>
                  <span className="mono" style={{ fontSize: 12, fontWeight: 700 }}>{temp(p.hour.temperature)}</span>
                  <span className="mono" style={{ fontSize: 12, fontWeight: 700, color, width: 54, textAlign: 'right' }}>
                    {Math.round(p.hour.windGusts)} km/h
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="pad mono" style={{ marginTop: 12, fontSize: 10.5, color: 'var(--mute)' }}>
          {assessment.passes.length} bodů · shoda modelů {assessment.agreement} %
          {track.fallback ? ' · trať se nenačetla, počítáno vzdušnou čarou' : ''}
        </div>
      </div>
    </div>
  )
}

const highestIndex = (route: Route) =>
  route.waypoints.reduce((best, w, i, arr) => (w.elevation > arr[best].elevation ? i : best), 0)

function Header({ onBack, title, sub }: { onBack: () => void; title: string; sub: string }) {
  return (
    <div className="pad" style={{ paddingTop: 20, paddingBottom: 12, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onBack} aria-label="Zpět" style={{ padding: 4, color: 'var(--dim)' }}>
          <Icon name="back" size={22} stroke={2.2} />
        </button>
        <h1 className="disp" style={{ fontSize: 19, fontWeight: 700, margin: 0 }}>{title}</h1>
      </div>
      {sub && <div className="sub" style={{ paddingLeft: 40, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function Strip({ children, borderBottom }: { children: React.ReactNode; borderBottom?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        borderBottom: borderBottom ? '1px solid var(--line)' : undefined,
        paddingBottom: borderBottom ? 4 : 0,
      }}
    >
      {children}
    </div>
  )
}

function Cell({ children, column, bottom }: { children: React.ReactNode; column?: boolean; bottom?: boolean }) {
  return (
    <div
      style={{
        flexGrow: 1,
        flexBasis: 0,
        display: 'flex',
        flexDirection: column ? 'column' : 'row',
        alignItems: 'center',
        justifyContent: bottom ? 'flex-end' : 'center',
        gap: column ? 3 : 0,
      }}
    >
      {children}
    </div>
  )
}
