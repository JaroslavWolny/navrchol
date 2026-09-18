import { Icon } from '../components/Icon'
import { Empty, ErrorState, Loading } from '../components/States'
import { modelDeviations, modelLabel } from '../lib/openMeteo'
import { formatDuration } from '../lib/pace'
import { clock, dayLabel, km, metres, num, temp } from '../lib/format'
import type { Assessment } from '../lib/plan'
import type { RouteData } from '../state/useRouteData'
import type { Route } from '../lib/types'

const TONE = {
  jdi: { color: 'var(--go)', wash: 'var(--go-wash)', word: 'JDI' },
  zvaz: { color: 'var(--warn)', wash: 'var(--warn-wash)', word: 'ZVAŽ' },
  nejdi: { color: 'var(--stop)', wash: 'var(--stop-wash)', word: 'NEJDI' },
}

/** Jedna věta, která shrne, proč verdikt vypadá takhle. */
function summaryOf(a: Assessment): string {
  if (a.score.blockers.length > 0) return a.score.blockers[0].text
  if (a.agreement < 55) {
    return 'Modely se mezi sebou neshodnou. Ráno se podívej na radar, než vyrazíš.'
  }
  if (a.score.verdict === 'jdi') {
    return a.score.warnings.length > 0
      ? `Dobré podmínky. ${a.score.warnings[0].text}`
      : 'Dobré podmínky po celé trase, nic vážného se nerýsuje.'
  }
  return a.score.warnings[0]?.text ?? 'Podmínky jsou na hraně, zvaž to podle sebe.'
}

const RING_R = 56
const RING_C = 2 * Math.PI * RING_R

interface Props {
  route: Route | null
  data: RouteData
  assessment: Assessment | null
  start: Date
  onStartChange: (d: Date) => void
  onEdit: () => void
  onTimeline: () => void
  onNew: () => void
}

export function VerdiktScreen({
  route,
  data,
  assessment,
  start,
  onStartChange,
  onEdit,
  onTimeline,
  onNew,
}: Props) {
  if (!route) {
    return (
      <div className="scroll">
        <Empty
          title="Žádná trasa"
          hint="Nejdřív přidej trasu, pak ti řeknu, jestli se na ni vyplatí jít."
          action={{ label: 'Nová trasa', onClick: onNew }}
        />
      </div>
    )
  }
  if (route.waypoints.length < 2) {
    return (
      <div className="scroll">
        <Empty
          title="Trasa nemá dost bodů"
          hint="Přidej aspoň dva body, ať je co spočítat."
          action={{ label: 'Upravit trasu', onClick: onEdit }}
        />
      </div>
    )
  }
  if (data.error) return <div className="scroll"><ErrorState message={data.error} onRetry={data.reload} /></div>
  if (!assessment) return <div className="scroll"><Loading what="Počítám podmínky na trase…" /></div>

  const tone = TONE[assessment.score.verdict]
  const score = assessment.score.score
  const summit = [...route.waypoints].sort((a, b) => b.elevation - a.elevation)[0]
  const summitPass = assessment.passes.find((p) => p.waypoint.id === summit.id) ?? assessment.passes[0]
  const h = summitPass.hour

  const maxGust = Math.max(...assessment.passes.map((p) => p.hour.windGusts))
  const totalPrecip = assessment.passes.reduce((s, p) => s + p.hour.precipitation, 0)
  const maxProb = Math.max(...assessment.passes.map((p) => p.hour.precipitationProbability))
  const visibilities = assessment.passes
    .map((p) => p.hour.visibility)
    .filter((v): v is number => v !== null)
  const minVis = visibilities.length ? Math.min(...visibilities) : null

  const summitPoint = data.forecast?.points.find((p) => p.waypointId === summit.id)
  const hourIdx = summitPoint
    ? Math.max(
        0,
        Math.min(
          summitPoint.hours.length - 1,
          Math.round(
            (summitPass.at.getTime() - new Date(summitPoint.hours[0].time).getTime()) / 3_600_000,
          ),
        ),
      )
    : 0
  const deviations = summitPoint ? modelDeviations(summitPoint, hourIdx) : []

  const startValue = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(
    start.getDate(),
  ).padStart(2, '0')}T${clock(start)}`

  return (
    <div className="scroll">
      <div className="pad row-between" style={{ alignItems: 'flex-start', paddingTop: 20 }}>
        <div className="stack" style={{ gap: 3, minWidth: 0 }}>
          <h1 className="disp" style={{ fontSize: 21, fontWeight: 700, margin: 0, lineHeight: 1.1 }}>
            {route.name || 'Bez názvu'}
          </h1>
          <div className="sub">
            {dayLabel(start)} · start {clock(start)} · {formatDuration(assessment.plan.minutes)}
          </div>
        </div>
        <label className="chip" style={{ position: 'relative', cursor: 'pointer' }}>
          <Icon name="clock" size={13} stroke={2} />
          Změnit
          <input
            type="datetime-local"
            value={startValue}
            onChange={(e) => e.target.value && onStartChange(new Date(e.target.value))}
            style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', cursor: 'pointer' }}
          />
        </label>
      </div>

      {/* hrdina: skóre */}
      <div
        className="pad"
        style={{ marginTop: 14 }}
      >
        <div
          style={{
            position: 'relative',
            height: 260,
            borderRadius: 20,
            overflow: 'hidden',
            background: tone.wash,
            border: '1px solid oklch(0.30 0.02 255)',
          }}
        >
          <svg
            viewBox="0 0 358 260"
            preserveAspectRatio="none"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            aria-hidden="true"
          >
            <g fill="none" stroke={tone.color} strokeWidth="1">
              {[196, 170, 146, 124, 104, 86].map((rx, i) => (
                <ellipse
                  key={rx}
                  cx="179"
                  cy="126"
                  rx={rx}
                  ry={rx * 0.62}
                  opacity={0.07 + i * 0.01}
                  transform={`rotate(${-8 + i} 179 126)`}
                />
              ))}
            </g>
          </svg>

          <div
            style={{
              position: 'relative',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 24px',
            }}
          >
            <div style={{ position: 'relative', width: 128, height: 128 }}>
              <svg width="128" height="128" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
                <circle cx="64" cy="64" r={RING_R} fill="none" stroke="oklch(0.30 0.02 255)" strokeWidth="6" />
                <circle
                  cx="64"
                  cy="64"
                  r={RING_R}
                  fill="none"
                  stroke={tone.color}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${(score / 100) * RING_C} ${RING_C}`}
                />
              </svg>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div
                  className="disp"
                  style={{ fontSize: 52, fontWeight: 800, lineHeight: 1, color: tone.color }}
                >
                  {score}
                </div>
                <div className="mono" style={{ fontSize: 9.5, letterSpacing: '0.16em', color: 'var(--mute)' }}>
                  ZE 100
                </div>
              </div>
            </div>
            <div
              className="disp"
              style={{ marginTop: 12, fontSize: 27, fontWeight: 800, letterSpacing: '0.02em', color: tone.color }}
            >
              {tone.word}
            </div>
            <div
              style={{
                fontSize: 13.5,
                lineHeight: 1.4,
                color: 'var(--dim)',
                textAlign: 'center',
                textWrap: 'pretty',
                maxWidth: 280,
                marginTop: 2,
              }}
            >
              {summaryOf(assessment)}
            </div>
          </div>
        </div>
      </div>

      {/* shoda modelů */}
      <div className="pad" style={{ marginTop: 12 }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '13px 14px' }}>
          <div className="row-between" style={{ alignItems: 'baseline' }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Shoda modelů</div>
            <div
              className="mono"
              style={{
                fontSize: 15,
                fontWeight: 700,
                color:
                  assessment.agreement >= 75
                    ? 'var(--go)'
                    : assessment.agreement >= 50
                      ? 'var(--warn)'
                      : 'var(--stop)',
              }}
            >
              {assessment.agreement} %
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {deviations.map((d) => (
              <div key={d.model} className="stack" style={{ flexGrow: 1, gap: 5, alignItems: 'center' }}>
                <div style={{ width: '100%', height: 4, borderRadius: 2, background: 'var(--card-3)', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.round((1 - d.deviation) * 100)}%`,
                      height: '100%',
                      borderRadius: 2,
                      background:
                        d.deviation < 0.15 ? 'var(--go)' : d.deviation < 0.4 ? 'var(--warn)' : 'var(--stop)',
                    }}
                  />
                </div>
                <div className="mono" style={{ fontSize: 9, color: 'var(--mute)' }}>
                  {modelLabel(d.model)}
                </div>
              </div>
            ))}
          </div>
          <div className="mono" style={{ fontSize: 10.5, color: 'var(--mute)' }}>
            teplota ±{num(assessment.spread.temperature, 1)} °C · nárazy ±
            {num(assessment.spread.windGusts, 0)} km/h · srážky ±{num(assessment.spread.precipitation, 1)} mm
          </div>
        </div>
      </div>

      {/* zákazy a varování */}
      {[...assessment.score.blockers, ...assessment.score.warnings].slice(0, 3).map((issue, i) => (
        <div className="pad" key={issue.key + i} style={{ marginTop: 10 }}>
          <div
            style={{
              padding: '11px 13px',
              borderRadius: 12,
              background: issue.severity === 'blok' ? 'var(--stop-wash)' : 'var(--warn-wash)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
            }}
          >
            <Icon
              name="warn"
              size={17}
              stroke={2}
              color={issue.severity === 'blok' ? 'var(--stop)' : 'var(--warn)'}
              style={{ marginTop: 1 }}
            />
            <div style={{ fontSize: 12.5, lineHeight: 1.42, textWrap: 'pretty' }}>{issue.text}</div>
          </div>
        </div>
      ))}

      {/* metriky */}
      <div className="pad" style={{ marginTop: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
          <Metric icon="thermo" label="POCITOVĚ" value={temp(h.apparentTemperature)} note={`${summit.name}, ${metres(summit.elevation)}`} />
          <Metric
            icon="wind"
            label="NÁRAZY"
            value={`${Math.round(maxGust)} km/h`}
            note="nejhorší bod trasy"
            color={maxGust >= 70 ? 'var(--stop)' : maxGust >= 50 ? 'var(--warn)' : undefined}
          />
          <Metric icon="drop" label="SRÁŽKY" value={`${num(totalPrecip, 1)} mm`} note={`pravděpodobnost ${Math.round(maxProb)} %`} />
          <Metric
            icon="eye"
            label="VIDITELNOST"
            value={minVis === null ? '—' : minVis >= 1000 ? `${num(minVis / 1000, 0)} km` : `${Math.round(minVis)} m`}
            note={minVis !== null && minVis < 2000 ? 'mlha na trase' : 'bez mlhy'}
          />
        </div>
      </div>

      <div className="pad mono" style={{ marginTop: 9, fontSize: 10.5, color: 'var(--mute)', lineHeight: 1.5 }}>
        Bouřka: {stormLabel(Math.max(...assessment.passes.map((p) => p.hour.cape)))} · Nulová izoterma{' '}
        {h.freezingLevel === null ? '—' : metres(h.freezingLevel)} · Trasa {km(assessment.plan.distanceKm)}
        {data.track?.fallback ? ' (vzdušnou čarou)' : ''}
      </div>

      <div className="pad" style={{ marginTop: 14 }}>
        <button className="btn" onClick={onTimeline}>
          <Icon name="peak" size={18} stroke={2.2} />
          Počasí podél trasy
        </button>
      </div>
    </div>
  )
}

function stormLabel(cape: number): string {
  if (cape >= 1200) return `vysoké riziko (CAPE ${Math.round(cape)})`
  if (cape >= 500) return `zvýšené riziko (CAPE ${Math.round(cape)})`
  if (cape >= 300) return `nízké riziko (CAPE ${Math.round(cape)})`
  return `bez rizika (CAPE ${Math.round(cape)})`
}

function Metric({
  icon,
  label,
  value,
  note,
  color,
}: {
  icon: 'thermo' | 'wind' | 'drop' | 'eye'
  label: string
  value: string
  note: string
  color?: string
}) {
  return (
    <div className="card-2" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--mute)' }}>
        <Icon name={icon} size={13} stroke={2} />
        <span style={{ fontSize: 10.5, fontWeight: 500, letterSpacing: '0.03em' }}>{label}</span>
      </div>
      <div className="mono" style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color }}>
        {value}
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--mute)' }}>{note}</div>
    </div>
  )
}
