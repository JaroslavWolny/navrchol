import { Icon, weatherIcon } from '../components/Icon'
import { Section } from '../components/Section'
import { Empty } from '../components/States'
import { haversine } from '../lib/geo'
import { bodu, clock, dayLabel, metres, temp } from '../lib/format'
import type { Assessment } from '../lib/plan'
import type { Track } from '../lib/routing'
import type { Route } from '../lib/types'

const W = 340
const H = 112

interface Profile {
  line: string
  area: string
  marks: Array<{ x: number; y: number }>
  /** Kam v obrázku padne daná nadmořská výška, nebo null když je mimo profil. */
  yOf: (elevation: number) => number | null
}

/** Výškový profil ze skutečné trati. */
function profilePath(track: Track): Profile {
  const pts = track.points
  if (pts.length < 2) return { line: '', area: '', marks: [], yOf: () => null }

  const dist: number[] = [0]
  for (let i = 1; i < pts.length; i++) dist.push(dist[i - 1] + haversine(pts[i - 1], pts[i]))
  const total = dist[dist.length - 1] || 1

  const elevations = pts.map((p) => p.elevation)
  const lo = Math.min(...elevations)
  const hi = Math.max(...elevations)
  const span = Math.max(1, hi - lo)

  // Odsazení od kraje, ať se značka prvního a posledního bodu neusekne.
  const x = (i: number) => 5 + (dist[i] / total) * (W - 10)
  const yAt = (elevation: number) => H - 10 - ((elevation - lo) / span) * (H - 24)
  const y = (i: number) => yAt(elevations[i])

  const line = pts.map((_, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(i).toFixed(1)}`).join(' ')
  return {
    line,
    area: `${line} L${W - 5} ${H - 4} L5 ${H - 4} Z`,
    marks: track.waypointIndices.map((i) => ({ x: x(i), y: y(i) })),
    yOf: (elevation: number) => (elevation < lo || elevation > hi ? null : yAt(elevation)),
  }
}

interface Props {
  route: Route | null
  track: Track | null
  assessment: Assessment | null
  onBack: () => void
}

export function TimelineScreen({ route, track, assessment, onBack }: Props) {
  if (!route || !assessment || !track || assessment.samples.length === 0) {
    return (
      <div className="app">
        <Topbar onBack={onBack} title="Počasí podél trasy" />
        <div className="scroll">
          <Empty title="Není co zobrazit" hint="Vrať se a vyber trasu s aspoň dvěma body." />
        </div>
      </div>
    )
  }

  const samples = assessment.samples
  const profile = profilePath(track)
  const worst = assessment.score.weakest
  const end = samples[samples.length - 1]
  const top = highestIndex(route)

  // Nejnižší nulová izoterma za túru: nad ní mrzne, a to je na profilu vidět líp
  // než v jednom čísle pod verdiktem.
  const freezing = samples
    .map((s) => s.hour.freezingLevel)
    .filter((f): f is number => f !== null)
  const freezingLow = freezing.length ? Math.min(...freezing) : null
  const freezingY = freezingLow === null ? null : profile.yOf(freezingLow)

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
            {samples.map((s) => {
              const gust = s.hour.windGustsRisk
              return (
                <div className="hour-col" key={s.at.toISOString()}>
                  <span className="mono" style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--paper-3)' }}>
                    {clock(s.at)}
                  </span>
                  <Icon
                    name={weatherIcon(
                      s.hour.precipitationRisk,
                      s.hour.cloudCover,
                      s.hour.visibility,
                      s.hour.snowfallRisk > 0.05,
                    )}
                    size={22}
                    stroke={1.6}
                    color={s.hour.cloudCover < 25 ? 'var(--sun)' : 'var(--paper-2)'}
                    style={{ margin: '3px 0' }}
                  />
                  <span className="mono" style={{ fontSize: 14, fontWeight: 600 }}>
                    {temp(s.hour.temperature).replace(' °C', '°')}
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
                      height: Math.max(1, Math.min(14, s.hour.precipitationRisk * 8)),
                      background: 'var(--cold)',
                      marginTop: 2,
                    }}
                  />
                  <span className="mono" style={{ fontSize: 9, color: 'var(--paper-4)' }}>
                    {Math.round(s.hour.precipitationProbability)}%
                  </span>
                </div>
              )
            })}
          </div>
          <p className="footnote" style={{ marginTop: 8 }}>
            teplota · nárazy v km/h · srážky a podíl členů ansámblu, kterým prší. Vše z místa,
            kde v tu hodinu podle tempa jsi; nárazy a srážky v nepříznivém kvartilu ansámblu,
            tedy v té hodnotě, ze které se skóruje.
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
            {freezingY !== null && (
              <>
                <rect x="0" y="0" width={W} height={freezingY} fill="var(--cold)" opacity="0.1" />
                <line
                  x1="0"
                  x2={W}
                  y1={freezingY}
                  y2={freezingY}
                  stroke="var(--cold)"
                  strokeWidth="1"
                  strokeDasharray="4 3"
                />
              </>
            )}
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
          {freezingLow !== null && (
            <p className="footnote" style={{ marginTop: 8 }}>
              {freezingY !== null
                ? `Nulová izoterma klesne na ${metres(freezingLow)} — nad čárkovanou čarou mrzne.`
                : freezingLow <= (track.points[0]?.elevation ?? 0)
                  ? `Nulová izoterma je na ${metres(freezingLow)}, tedy pod celou trasou — mrzne všude.`
                  : `Nulová izoterma zůstane na ${metres(freezingLow)}, nad celou trasou.`}
            </p>
          )}
        </Section>

        {worst && (
          // Nejslabší hodina existuje vždycky — i na skvělé trase. Výstražný tón
          // se proto rozsvítí až tam, kde se opravdu něco děje.
          <div className="sec" data-tone={worst.score < 35 ? 'nejdi' : worst.score < 65 ? 'zvaz' : 'none'}>
            <div className="note">
              {worst.score < 65 && <Icon name="warn" size={15} stroke={2} />}
              <div>
                <strong>Nejslabší hodina: {worst.waypoint.name}</strong>
                <div style={{ marginTop: 3, color: 'var(--paper-2)' }}>
                  Budeš tam v {clock(new Date(worst.hour.time))}, skóre {worst.score} ze 100.
                  {worst.penalties[0]
                    ? ` Nejvíc bere ${worst.penalties[0].label.toLowerCase()}: ${worst.penalties[0].detail}.`
                    : ''}
                </div>
              </div>
            </div>
          </div>
        )}

        <Section label="V bodech trasy" meta={bodu(assessment.passes.length)}>
          <div className="rows">
            {assessment.passes.map((p) => {
              const gust = p.hour.windGustsRisk
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
            {assessment.certainty === null
              ? 'Ansámbl nedorazil, skóre je z jednoho modelu'
              : `Jistota ${assessment.certainty} %`}
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
