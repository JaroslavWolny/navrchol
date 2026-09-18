import { Gauge } from '../components/Gauge'
import { Icon } from '../components/Icon'
import { RadarMap } from '../components/RadarMap'
import { Scroll } from '../components/Scroll'
import { Section } from '../components/Section'
import { Empty, ErrorState, Loading } from '../components/States'
import { modelDeviations, modelLabel } from '../lib/openMeteo'
import { formatDuration } from '../lib/pace'
import { bodu, clock, dayLabel, km, metres, num, temp } from '../lib/format'
import type { Assessment } from '../lib/plan'
import type { RouteData } from '../state/useRouteData'
import type { Route } from '../lib/types'

const WORD = { jdi: 'JDI', zvaz: 'ZVAŽ', nejdi: 'NEJDI' } as const

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
  if (!assessment) return <div className="scroll"><Loading what="počítám podmínky na trase" /></div>
  if (assessment.passes.length === 0) {
    return (
      <div className="scroll">
        <ErrorState
          message="Pro body téhle trasy nedorazila žádná předpověď. Zkus to znovu, nebo zkontroluj, že body leží na souši."
          onRetry={data.reload}
        />
      </div>
    )
  }

  const verdict = assessment.score.verdict
  const score = assessment.score.score
  const summit = [...route.waypoints].sort((a, b) => b.elevation - a.elevation)[0]
  const summitPass = assessment.passes.find((p) => p.waypoint.id === summit.id) ?? assessment.passes[0]
  const h = summitPass.hour
  const end = assessment.plan.arrivals.at(-1)?.at ?? start

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

  const breakdown = assessment.score.weakest?.penalties ?? []
  // Pruhy se poměřují k nejhorší penalizaci, ale nejmíň k dvaceti bodům. Bez
  // toho vypadá osamocená ztráta čtyř bodů jako plný pruh, tedy jako katastrofa.
  const penaltyScale = Math.max(20, breakdown[0]?.points ?? 1)
  const weakestAt = assessment.score.weakest
    ? assessment.passes.find((p) => p.waypoint.id === assessment.score.weakest!.waypoint.id)?.at
    : undefined

  const startValue = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(
    start.getDate(),
  ).padStart(2, '0')}T${clock(start)}`

  return (
    <Scroll onRefresh={data.reload} refreshing={data.loading}>
      <header className="masthead">
        <h1>{route.name || 'Bez názvu'}</h1>
        <label className="masthead-time">
          <span>
            {dayLabel(start)} · {clock(start)}→{clock(end)}
          </span>
          <span style={{ color: 'var(--paper-4)' }}>{formatDuration(assessment.plan.minutes)}</span>
          <Icon name="chevron" size={13} stroke={2} />
          <input
            type="datetime-local"
            value={startValue}
            aria-label="Čas startu"
            onChange={(e) => e.target.value && onStartChange(new Date(e.target.value))}
          />
        </label>
      </header>

      {/* Verdikt. Slovo je větší než číslo schválně — appka má vydat rozhodnutí,
          skóre je až jeho doklad. */}
      <div className="sec" style={{ marginTop: 20 }} data-tone={verdict}>
        <div className="verdict">
          <div className="verdict-head">
            <div className="verdict-word">{WORD[verdict]}</div>
            <div className="verdict-score">
              <b>{score}</b>
              <span>/100</span>
            </div>
          </div>
          <Gauge score={score} tone={verdict} size="lg" scale />
          <p className="verdict-why">{summaryOf(assessment)}</p>
        </div>
      </div>

      {[...assessment.score.blockers, ...assessment.score.warnings].slice(0, 3).map((issue, i) => (
        <div className="sec sec--tight" key={issue.key + i} data-tone={issue.severity === 'blok' ? 'nejdi' : 'zvaz'}>
          <div className="note">
            <Icon name="warn" size={15} stroke={2} />
            <div>{issue.text}</div>
          </div>
        </div>
      ))}

      <Section label="Měření na trase" meta={bodu(assessment.passes.length)}>
        <div className="rows">
          <Measure label="Pocitově" note={`${summit.name}, ${metres(summit.elevation)}`} value={temp(h.apparentTemperature)} />
          <Measure
            label="Nárazy"
            note="nejhorší bod trasy"
            value={`${Math.round(maxGust)} km/h`}
            tone={maxGust >= 70 ? 'nejdi' : maxGust >= 50 ? 'zvaz' : undefined}
          />
          <Measure
            label="Srážky"
            note={`pravděpodobnost ${Math.round(maxProb)} %`}
            value={`${num(totalPrecip, 1)} mm`}
          />
          <Measure
            label="Viditelnost"
            note={minVis !== null && minVis < 2000 ? 'mlha na trase' : 'bez mlhy'}
            value={minVis === null ? '—' : minVis >= 1000 ? `${num(minVis / 1000, 0)} km` : `${Math.round(minVis)} m`}
            tone={minVis !== null && minVis < 1000 ? 'nejdi' : undefined}
          />
        </div>
      </Section>

      {/* Rozpad skóre — ať jde to číslo rozporovat, ne jen věřit. */}
      <Section
        label={`Proč ${score}`}
        meta={
          assessment.score.weakest
            ? `${assessment.score.weakest.waypoint.name}${weakestAt ? ` v ${clock(weakestAt)}` : ''}`
            : undefined
        }
      >
        {breakdown.length === 0 ? (
          <p className="body">
            Nic ti tam body nesebralo — teplota, vítr, srážky i viditelnost jsou v pohodě.
          </p>
        ) : (
          <div className="rows">
            {breakdown.map((pen) => (
              <div
                className="row"
                key={pen.key}
                data-tone={pen.points >= 20 ? 'nejdi' : pen.points >= 8 ? 'zvaz' : 'none'}
              >
                <div className="row-key" style={{ fontSize: 13, fontWeight: 600 }}>
                  {pen.label}
                </div>
                <div style={{ flexGrow: 1, minWidth: 0 }}>
                  <div className="bar">
                    <span style={{ width: `${Math.min(100, Math.max(4, (pen.points / penaltyScale) * 100))}%` }} />
                  </div>
                  <div className="footnote" style={{ marginTop: 5 }}>
                    {pen.detail}
                  </div>
                </div>
                <div
                  className="row-value"
                  style={{ width: 34, textAlign: 'right', color: 'var(--tone)' }}
                >
                  &minus;{Math.round(pen.points)}
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="footnote" style={{ marginTop: 12 }}>
          Skóre trasy je ze 60 % z nejslabšího místa a ze 40 % z průměru všech bodů — jedna zlá
          hodina na hřebeni váží víc než šest hezkých v lese.
        </p>
      </Section>

      <Section
        label="Shoda modelů"
        meta={
          <span
            data-tone={assessment.agreement >= 75 ? 'jdi' : assessment.agreement >= 50 ? 'zvaz' : 'nejdi'}
            style={{ color: 'var(--tone)', fontWeight: 600, fontSize: 12 }}
          >
            {assessment.agreement} %
          </span>
        }
      >
        <div style={{ display: 'flex', gap: 8 }}>
          {deviations.map((d) => (
            <div
              key={d.model}
              style={{ flexGrow: 1, flexBasis: 0, minWidth: 0 }}
              data-tone={d.deviation < 0.15 ? 'jdi' : d.deviation < 0.4 ? 'zvaz' : 'nejdi'}
            >
              <div className="bar">
                <span style={{ width: `${Math.round((1 - d.deviation) * 100)}%` }} />
              </div>
              <div className="footnote" style={{ marginTop: 5 }}>
                {modelLabel(d.model)}
              </div>
            </div>
          ))}
        </div>
        <p className="footnote" style={{ marginTop: 12 }}>
          teplota ±{num(assessment.spread.temperature, 1)} °C · nárazy ±
          {num(assessment.spread.windGusts, 0)} km/h · srážky ±{num(assessment.spread.precipitation, 1)} mm
        </p>
      </Section>

      {/* Appka výš sama radí ověřit si radar, tak ho rovnou ukáže. */}
      <Section label="Srážkový radar" meta="poslední 2 h">
        <RadarMap track={data.track} center={summit} />
      </Section>

      <div className="sec">
        <p className="footnote">
          Bouřka: {stormLabel(Math.max(...assessment.passes.map((p) => p.hour.cape)))}
          <br />
          Nulová izoterma {h.freezingLevel === null ? '—' : metres(h.freezingLevel)} · Trasa{' '}
          {km(assessment.plan.distanceKm)}
          {data.track?.fallback ? ' (vzdušnou čarou)' : ''}
          {data.fetchedAt ? ` · staženo v ${clock(new Date(data.fetchedAt))}` : ''}
        </p>
      </div>

      <div className="sec">
        <button className="btn" onClick={onTimeline}>
          <Icon name="peak" size={17} stroke={2} />
          Počasí podél trasy
        </button>
      </div>
    </Scroll>
  )
}

function stormLabel(cape: number): string {
  if (cape >= 1200) return `vysoké riziko (CAPE ${Math.round(cape)})`
  if (cape >= 500) return `zvýšené riziko (CAPE ${Math.round(cape)})`
  if (cape >= 300) return `nízké riziko (CAPE ${Math.round(cape)})`
  return `bez rizika (CAPE ${Math.round(cape)})`
}

/** Řádek naměřené hodnoty: co, kde, kolik. */
function Measure({
  label,
  note,
  value,
  tone,
}: {
  label: string
  note: string
  value: string
  tone?: 'zvaz' | 'nejdi'
}) {
  return (
    <div className="row" data-tone={tone}>
      <span className="label row-key">{label}</span>
      <span className="hint truncate" style={{ flexGrow: 1 }}>
        {note}
      </span>
      <span className="row-value" style={tone ? { color: 'var(--tone)' } : undefined}>
        {value}
      </span>
    </div>
  )
}
