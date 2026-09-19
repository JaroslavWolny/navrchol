import { Gauge } from '../components/Gauge'
import { Icon } from '../components/Icon'
import { RadarMap } from '../components/RadarMap'
import { Scroll } from '../components/Scroll'
import { Section } from '../components/Section'
import { Empty, ErrorState, Loading } from '../components/States'
import { modelLabel } from '../lib/openMeteo'
import { formatDuration } from '../lib/pace'
import { clock, dayLabel, km, metres, num, temp } from '../lib/format'
import type { Assessment } from '../lib/plan'
import type { RouteData } from '../state/useRouteData'
import type { Route } from '../lib/types'

const WORD = { jdi: 'JDI', zvaz: 'ZVAŽ', nejdi: 'NEJDI' } as const

/** Jedna věta, která shrne, proč verdikt vypadá takhle. */
function summaryOf(a: Assessment): string {
  if (a.score.blockers.length > 0) return a.score.blockers[0].text
  if (a.certainty !== null && a.certainty < 55) {
    return 'Skóre se v rozptylu ansámblu hýbe o desítky bodů. Ráno se podívej na radar, než vyrazíš.'
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
  if (assessment.samples.length === 0) {
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
  const h = summitPass?.hour ?? assessment.samples[0].hour
  const end = assessment.plan.arrivals.at(-1)?.at ?? start

  const samples = assessment.samples
  const minApparent = Math.min(...samples.map((s) => s.hour.apparentTemperatureRisk))
  const maxGust = Math.max(...samples.map((s) => s.hour.windGustsRisk))
  const maxGustTail = Math.max(...samples.map((s) => s.hour.windGustsHigh))
  const maxProb = Math.max(...samples.map((s) => s.hour.precipitationProbability))
  const maxSnowDepth = Math.max(...samples.map((s) => s.hour.snowDepth))
  const visibilities = samples
    .map((s) => s.hour.visibility)
    .filter((v): v is number => v !== null)
  const minVis = visibilities.length ? Math.min(...visibilities) : null
  const maxCape = Math.max(...samples.map((s) => s.hour.capeRisk))

  const breakdown = assessment.score.weakest?.penalties ?? []
  // Pruhy se poměřují k nejhorší penalizaci, ale nejmíň k dvaceti bodům. Bez
  // toho vypadá osamocená ztráta čtyř bodů jako plný pruh, tedy jako katastrofa.
  const penaltyScale = Math.max(20, breakdown[0]?.points ?? 1)
  const weakestAt = assessment.score.weakest ? new Date(assessment.score.weakest.hour.time) : null
  const reserve = assessment.daylightReserveMin
  const storm = assessment.storm

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

      {/* Bouřka se neřeší frází „buď dole do poledne", ale hodinou. */}
      {storm && (
        <Section label="Bouřka a obrat" meta={`riziko od ${clock(storm.from)}`}>
          <div className="rows">
            <Measure
              label="Obrat nahoře"
              note={`sestup z hřebene ${formatDuration(storm.exitMin)}`}
              value={clock(storm.turnaround)}
              tone="zvaz"
            />
            <Measure
              label="Nejpozdější start"
              note={
                storm.latestStart < start
                  ? `o ${formatDuration((start.getTime() - storm.latestStart.getTime()) / 60000)} dřív, než máš`
                  : 'tvůj start se do okna vejde'
              }
              value={clock(storm.latestStart)}
              tone={storm.latestStart < start ? 'nejdi' : undefined}
            />
          </div>
          <p className="footnote" style={{ marginTop: 12 }}>
            Riziko začíná, když CAPE přeleze 500 J/kg a aspoň dvě pětiny členů ansámblu hlásí
            srážky. Obrat je ten čas, kdy se ještě stihneš dostat pod hranici lesa.
          </p>
        </Section>
      )}

      <Section label="Měření na trase" meta="hodinu po hodině">
        <div className="rows">
          {/* Ukazuje se ta hodnota, ze které se skóruje. Medián na vrcholu vedle
              rozpadu, který počítá z nepříznivého kvartilu, by si odporovaly. */}
          <Measure
            label="Pocitově"
            note="nejchladnější hodina trasy"
            value={temp(minApparent)}
            tone={minApparent <= -8 ? 'nejdi' : minApparent <= 0 ? 'zvaz' : undefined}
          />
          <Measure
            label="Nárazy"
            note={maxGustTail > maxGust + 8 ? `v chvostu ansámblu ${Math.round(maxGustTail)} km/h` : 'nejhorší hodina trasy'}
            value={`${Math.round(maxGust)} km/h`}
            tone={maxGust >= 70 ? 'nejdi' : maxGust >= 50 ? 'zvaz' : undefined}
          />
          <Measure
            label="Srážky"
            note={`za celou túru, prší ${Math.round(maxProb)} % členů`}
            value={`${num(assessment.score.rainMm, 1)} mm`}
            tone={assessment.score.rainMm >= 8 ? 'nejdi' : assessment.score.rainMm >= 3 ? 'zvaz' : undefined}
          />
          <Measure
            label="Viditelnost"
            note={minVis !== null && minVis < 2000 ? 'mlha na trase' : 'bez mlhy'}
            value={minVis === null ? '—' : minVis >= 1000 ? `${num(minVis / 1000, 0)} km` : `${Math.round(minVis)} m`}
            tone={minVis !== null && minVis < 1000 ? 'nejdi' : undefined}
          />
        </div>
      </Section>

      <Section label="Světlo a terén" meta={dayLabel(start)}>
        <div className="rows">
          <Measure
            label="Do tmy"
            note={
              reserve === null
                ? 'časy slunce nedorazily'
                : reserve < 0
                  ? 'vracíš se po západu, čelovka povinně'
                  : 'mezi koncem túry a západem slunce'
            }
            value={reserve === null ? '—' : reserve < 0 ? `−${formatDuration(-reserve)}` : formatDuration(reserve)}
            tone={reserve === null ? undefined : reserve < 0 ? 'nejdi' : reserve < 60 ? 'zvaz' : undefined}
          />
          <Measure
            label="Před startem spadlo"
            note={`za 48 h ${num(assessment.wetGround.mm48, 1)} mm · ${groundLabel(assessment.wetGround.mm24)}`}
            value={`${num(assessment.wetGround.mm24, 1)} mm`}
            tone={assessment.wetGround.mm24 >= 20 ? 'nejdi' : assessment.wetGround.mm24 >= 8 ? 'zvaz' : undefined}
          />
          {maxSnowDepth > 0.02 && (
            <Measure
              label="Sníh na trase"
              note={maxSnowDepth >= 0.3 ? 'tempo je přepočítané na prošlapávání' : 'jen vrchní část trasy'}
              value={`${Math.round(maxSnowDepth * 100)} cm`}
              tone={maxSnowDepth >= 0.4 ? 'zvaz' : undefined}
            />
          )}
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
          Skóre trasy je ze 60 % z nejslabší hodiny a ze 40 % z průměru všech — jedna zlá
          hodina na hřebeni váží víc než šest hezkých v lese. Penalizace se počítají
          z nepříznivého kvartilu ansámblu, ne z nejpravděpodobnější hodnoty.
        </p>
      </Section>

      <Section
        label="Jistota"
        meta={
          <span
            data-tone={
              assessment.certainty === null
                ? 'none'
                : assessment.certainty >= 75
                  ? 'jdi'
                  : assessment.certainty >= 50
                    ? 'zvaz'
                    : 'nejdi'
            }
            style={{ color: 'var(--tone)', fontWeight: 600, fontSize: 12 }}
          >
            {assessment.certainty === null ? 'bez ansámblu' : `${assessment.certainty} %`}
          </span>
        }
      >
        <p className="body">
          {assessment.certainty === null
            ? 'Ansámbl se nestáhl, takže se skóruje z jednoho modelu bez rezervy na horší scénář. Ber číslo s rezervou.'
            : `Mezi nejlepší a nepříznivou variantou ansámblu se skóre hýbe o ${Math.round(
                ((100 - assessment.certainty) / 1.4),
              )} bodů.`}
        </p>
        <p className="footnote" style={{ marginTop: 10 }}>
          rozptyl p10—p90: teplota {num(assessment.spread.temperature, 1)} °C · nárazy{' '}
          {num(assessment.spread.windGusts, 0)} km/h · srážky {num(assessment.spread.precipitation, 1)} mm
          {data.forecast && data.forecast.ensembles.length > 0
            ? ` · ${data.forecast.ensembles.map(modelLabel).join(' + ')}, ${Math.max(
                ...samples.map((s) => s.hour.members),
              )} členů`
            : ''}
        </p>
      </Section>

      {/* Appka výš sama radí ověřit si radar, tak ho rovnou ukáže. */}
      <Section label="Srážkový radar" meta="poslední 2 h">
        <RadarMap track={data.track} center={summit} />
      </Section>

      <div className="sec">
        <p className="footnote">
          Bouřka: {stormLabel(maxCape)}
          <br />
          Nulová izoterma {h.freezingLevel === null ? '—' : metres(h.freezingLevel)} · Trasa{' '}
          {km(assessment.plan.distanceKm)}
          {route.roundTrip ? ' tam a zpět' : ' jednosměrně'}
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

/** Co dělá spadlá voda s terénem. */
function groundLabel(mm24: number): string {
  if (mm24 >= 20) return 'rozbahněno, brody vysoké'
  if (mm24 >= 8) return 'mokré kameny a korní'
  if (mm24 >= 2) return 'vlhko, ale schůdné'
  return 'suchý terén'
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
