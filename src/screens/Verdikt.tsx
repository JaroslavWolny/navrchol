import { useState, type ReactNode } from 'react'
import { DayStrip } from '../components/DayStrip'
import { HikeChart } from '../components/HikeChart'
import { HourStrip } from '../components/HourStrip'
import { Icon, type IconName } from '../components/Icon'
import { RadarMap } from '../components/RadarMap'
import { RouteMap } from '../components/RouteMap'
import { Screen } from '../components/Screen'
import { Cell, Section, Sheet } from '../components/ui'
import { Empty, ErrorState, Loading } from '../components/States'
import { modelLabel } from '../lib/openMeteo'
import { haversine } from '../lib/geo'
import type { Issue } from '../lib/score'
import {
  ago,
  capital,
  fromWhen,
  clock,
  dayLabel,
  duration,
  hhmm,
  km,
  metres,
  num,
  parseDay,
  plural,
  signed,
  vlna,
} from '../lib/format'
import { dayKey, type Assessment, type DayOutlook, type Sample } from '../lib/plan'
import type { RouteData } from '../state/useRouteData'
import type { Route } from '../lib/types'

const WORD = { jdi: 'Jdi', zvaz: 'Zvaž', nejdi: 'Nejdi' } as const

const ISSUE_ICON: Record<string, IconName> = {
  vitr: 'wind',
  'vitr-chvost': 'wind',
  bourka: 'bolt',
  mlha: 'eye',
  srazky: 'drop',
  snih: 'snowflake',
  'snih-lezi': 'snowflake',
  podchlazeni: 'thermo',
  omrzliny: 'thermo',
  namraza: 'snowflake',
}

/** Jedna věta, která shrne, proč verdikt vypadá takhle. */
function summaryOf(a: Assessment): string {
  const blocker = a.score.blockers[0] ?? a.score.warnings.find((w) => w.bypassed)
  if (blocker) return `${blocker.title}. ${blocker.detail}`
  if (a.certainty !== null && a.certainty < 55) {
    return 'Scénáře předpovědi se rozcházejí. Rozhodni se ráno podle radaru.'
  }
  const [warning] = a.score.warnings
  if (a.score.verdict === 'jdi') {
    return warning ? `Dobré podmínky. Počítej s tímhle: ${warning.title.toLowerCase()}.` : 'Dobré podmínky po celé trase.'
  }
  if (warning) return `${warning.title}. ${warning.detail}`
  const weak = a.score.weakest?.penalties[0]
  return weak ? `Na hraně. Nejvíc bere ${weak.label.toLowerCase()} (${weak.detail}).` : 'Podmínky jsou na hraně.'
}

function worst<T>(samples: Sample[], value: (s: Sample) => T, better: (a: T, b: T) => boolean) {
  return samples.reduce((acc, s) => (better(value(s), value(acc)) ? s : acc), samples[0])
}

interface Props {
  route: Route | null
  routes: Route[]
  data: RouteData
  assessment: Assessment | null
  week: DayOutlook[] | null
  start: Date
  onStartChange: (d: Date) => void
  onPickRoute: (id: string) => void
  onEdit: () => void
  onNew: () => void
}

export function VerdiktScreen(props: Props) {
  const { route, routes, data, assessment, week, start, onStartChange, onPickRoute, onEdit, onNew } = props
  const [switching, setSwitching] = useState(false)

  if (!route) {
    return (
      <Screen title="Verdikt">
        <Empty
          title="Žádná trasa"
          hint="Přidej trasu a appka ti řekne, jestli se na ni vyplatí jít."
          action={{ label: 'Nová trasa', onClick: onNew }}
        />
      </Screen>
    )
  }

  const title = (
    <button className="hd-route" onClick={() => setSwitching(true)}>
      <span>{route.name || 'Bez názvu'}</span>
      {routes.length > 1 && <Icon name="chevronDown" size={22} stroke={2.2} />}
    </button>
  )

  const switcher = (
    <Sheet open={switching} title="Trasy" onClose={() => setSwitching(false)}>
      <div className="list">
        {routes.map((r) => (
          <Cell
            key={r.id}
            title={r.name || 'Bez názvu'}
            sub={r.waypoints.map((w) => w.name).join(' → ')}
            onClick={() => {
              onPickRoute(r.id)
              setSwitching(false)
            }}
          >
            {r.id === route.id && <Icon name="check" size={20} stroke={2.4} />}
          </Cell>
        ))}
      </div>
      <div className="page mt-12">
        <button
          className="btn btn--gray"
          onClick={() => {
            setSwitching(false)
            onNew()
          }}
        >
          <Icon name="plus" size={18} stroke={2.2} />
          Nová trasa
        </button>
      </div>
    </Sheet>
  )

  const actions = (
    <>
      {assessment && (
        <button className="icon-btn icon-btn--card" onClick={() => void share(route, assessment)} aria-label="Sdílet plán">
          <Icon name="share" size={20} />
        </button>
      )}
      <button className="icon-btn icon-btn--card" onClick={onEdit} aria-label="Upravit trasu">
        <Icon name="edit" size={20} />
      </button>
    </>
  )

  const track = data.oneWay
  const first = route.waypoints[0]
  const last = route.waypoints[route.waypoints.length - 1]
  const loop = !route.roundTrip && route.waypoints.length > 2 && haversine(first, last) < 0.2
  const kind = route.roundTrip ? 'tam a zpět' : loop ? 'okruh' : 'jedním směrem'
  const subtitle = track
    ? `${km(route.roundTrip ? track.lengthKm * 2 : track.lengthKm)} · ↑ ${metres(route.roundTrip ? track.ascentM + track.descentM : track.ascentM)} · ${kind}`
    : route.waypoints.map((w) => w.name).join(' → ')

  const shell = (children: ReactNode) => (
    <Screen
      title={title}
      actions={actions}
      eyebrow={subtitle}
      onRefresh={data.reload}
      refreshing={data.loading && Boolean(assessment)}
    >
      {children}
      {switcher}
    </Screen>
  )

  if (route.waypoints.length < 2) {
    return shell(
      <Empty
        title="Trasa nemá dost bodů"
        hint="Přidej aspoň start a cíl, ať je co spočítat."
        action={{ label: 'Upravit trasu', onClick: onEdit, icon: 'edit' }}
      />,
    )
  }
  if (data.error) return shell(<ErrorState message={data.error} onRetry={data.reload} />)
  if (!assessment || !data.track) return shell(<Loading what="Počítám podmínky na trase" />)
  if (assessment.samples.length === 0) {
    return shell(
      <ErrorState
        message="Pro tenhle den předpověď nesahá. Vyber bližší den, nebo stáhni předpověď znovu."
        onRetry={data.reload}
      />,
    )
  }

  const a = assessment
  const verdict = a.score.verdict
  const samples = a.samples
  const selectedDay = dayKey(start)

  const days = (week ?? []).map((d) => ({ date: d.date, best: d.best?.score ?? null }))
  const pickDay = (date: string) => {
    const d = parseDay(date)
    d.setHours(start.getHours(), start.getMinutes(), 0, 0)
    // Dnešní start, který už proběhl, se posune na nejbližší celou hodinu.
    const now = new Date()
    if (d < now && dayKey(d) === dayKey(now)) d.setHours(now.getHours() + 1, 0, 0, 0)
    onStartChange(d)
  }

  const coldest = worst(samples, (s) => s.hour.apparentTemperatureRisk, (x, y) => x < y)
  const windiest = worst(samples, (s) => s.hour.windGustsRisk, (x, y) => x > y)
  const wettest = worst(samples, (s) => s.hour.precipitationProbability, (x, y) => x > y)
  const visible = samples.filter((s) => s.hour.visibility !== null)
  const foggiest = visible.length ? worst(visible, (s) => s.hour.visibility ?? 1e9, (x, y) => x < y) : null
  const freezing = samples.map((s) => s.hour.freezingLevel).filter((f): f is number => f !== null)
  const freezeLow = freezing.length ? Math.min(...freezing) : null
  const maxSnow = Math.max(...samples.map((s) => s.hour.snowDepth))
  const top = Math.max(...data.track.points.map((p) => p.elevation))

  const issues = [...a.score.blockers, ...a.score.warnings]
  const gust = Math.round(windiest.hour.windGustsRisk)
  const reserve = a.daylightReserveMin
  const breakdown = a.score.weakest?.penalties ?? []
  const penaltyScale = Math.max(20, breakdown[0]?.points ?? 1)
  const stale = data.fetchedAt !== null && Date.now() - data.fetchedAt > 3 * 3_600_000

  return shell(
    <>
      {(data.offline || stale) && data.fetchedAt !== null && (
        <div className="banner mt-8" data-tone="zvaz" style={{ marginBottom: 4 }}>
          <Icon name="clock" size={18} stroke={2} />
          <span>
            {data.offline
              ? `${data.offline}. Ukazuju předpověď ${fromWhen(data.fetchedAt)}.`
              : `Předpověď je ${fromWhen(data.fetchedAt)}. Novou stáhneš tažením dolů.`}
          </span>
        </div>
      )}

      {days.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <DayStrip days={days} selected={selectedDay} onSelect={pickDay} />
        </div>
      )}

      <div className="page" style={{ marginTop: 16 }}>
        <section className="verdict" data-tone={verdict} aria-label="Verdikt">
          <div className="verdict-meta">
            <span>Verdikt · {dayLabel(start)}</span>
            {data.forecast && <span>{plural(data.forecast.sites.length, 'místo', 'místa', 'míst')} na trase</span>}
          </div>
          <div className="verdict-top">
            <div className="verdict-word" data-len={WORD[verdict].length}>
              {WORD[verdict]}
            </div>
            <div className="score">
              <b>{a.score.score}</b>
              <span>bodů ze 100</span>
            </div>
          </div>
          <p className="verdict-why">{vlna(summaryOf(a))}</p>
          <HourStrip assessment={a} roundTrip={route.roundTrip === true} />
          <div className="verdict-foot">
            <label className="pill pill--ink time-pick">
              <Icon name="clock" size={18} stroke={2} />
              Start {clock(start)}
              <input
                type="time"
                value={hhmm(start)}
                aria-label="Čas startu"
                onChange={(e) => {
                  if (!e.target.value) return
                  const [h, m] = e.target.value.split(':').map(Number)
                  const d = new Date(start)
                  d.setHours(h, m, 0, 0)
                  onStartChange(d)
                }}
              />
            </label>
            <span className="t-foot" style={{ textAlign: 'right', lineHeight: 1.3 }}>
              {duration(a.plan.minutes)}
              {a.plan.breakMin > 0 && (
                <>
                  <br />
                  vč. pauzy {a.plan.breakMin} min
                </>
              )}
            </span>
          </div>
        </section>
      </div>

      {issues.length > 0 && (
        <div className="list mt-12">
          {issues.slice(0, 5).map((issue) => (
            <IssueRow key={issue.key} issue={issue} />
          ))}
        </div>
      )}

      {a.storm && (
        <Section title="Bouřky" aside={<span className="aside">od {clock(a.storm.from)}</span>}>
          <div className="list">
            <Cell
              icon="flag"
              tone="zvaz"
              title="Otoč se nejpozději"
              sub={`${a.storm.summit}, sestup pod hranici lesa ${duration(a.storm.exitMin)}`}
              value={clock(a.storm.turnaround)}
            />
            <Cell
              icon="walk"
              tone={a.storm.latestStart < start ? 'nejdi' : 'jdi'}
              title="Vyraž nejpozději"
              sub={
                a.storm.latestStart < start
                  ? `O ${duration((start.getTime() - a.storm.latestStart.getTime()) / 60000)} dřív, než máš v plánu.`
                  : 'Tvůj start se do okna vejde.'
              }
              value={clock(a.storm.latestStart)}
            />
          </div>
        </Section>
      )}

      <Section title="Průběh túry" aside={<span className="aside">{capital(dayLabel(start))}</span>}>
        <div className="card card-pad" style={{ margin: '0 var(--g)' }}>
          <HikeChart assessment={a} track={data.track} />
        </div>
      </Section>

      <Section title="Na trase" aside={<span className="aside">Nepříznivý scénář</span>}>
        <div className="tiles">
          <Tile
            icon="thermo"
            label="Pocitově"
            tone={coldest.hour.apparentTemperatureRisk <= -8 ? 'nejdi' : coldest.hour.apparentTemperatureRisk <= 2 ? 'zvaz' : undefined}
            value={signed(Math.round(coldest.hour.apparentTemperatureRisk))}
            unit="°C"
            note={`nejchladněji v ${clock(coldest.at)}, ${coldest.where.name}`}
          />
          <Tile
            icon="wind"
            label="Nárazy větru"
            tone={gust >= 70 ? 'nejdi' : gust >= 50 ? 'zvaz' : undefined}
            value={gust}
            unit="km/h"
            note={windiest.hour.ridgeWind ? `na hřebeni kolem ${clock(windiest.at)}` : `nejvíc kolem ${clock(windiest.at)}`}
          />
          <Tile
            icon="drop"
            label="Srážky"
            tone={a.score.rainMm >= 8 ? 'nejdi' : a.score.rainMm >= 2 ? 'zvaz' : undefined}
            value={num(a.score.rainMm, 1)}
            unit="mm"
            note={
              wettest.hour.precipitationProbability >= 10
                ? `šance na déšť až ${Math.round(wettest.hour.precipitationProbability)} %`
                : 'bez deště'
            }
          />
          <Tile
            icon="eye"
            label="Viditelnost"
            tone={foggiest && (foggiest.hour.visibility ?? 1e9) < 1000 ? 'nejdi' : foggiest && (foggiest.hour.visibility ?? 1e9) < 3000 ? 'zvaz' : undefined}
            {...visibilityValue(foggiest?.hour.visibility ?? null)}
            note={
              foggiest && (foggiest.hour.visibility ?? 1e9) < 3000
                ? `mlha kolem ${clock(foggiest.at)}`
                : 'bez mlhy'
            }
          />
        </div>
      </Section>

      <Section title="Světlo a terén">
        <div className="list">
          {a.sunset && (
            <Cell
              icon="sunset"
              tone={reserve !== null && reserve < 0 ? 'nejdi' : reserve !== null && reserve < 60 ? 'zvaz' : 'sun'}
              title="Západ slunce"
              sub={
                reserve === null
                  ? undefined
                  : reserve < 0
                    ? `Vracíš se ${duration(-reserve)} po západu. Čelovka povinně.`
                    : `Po návratu zbývá ${duration(reserve)} světla.`
              }
              value={clock(a.sunset)}
            />
          )}
          {a.startsBeforeSunrise && a.sunrise && (
            <Cell icon="sunrise" tone="sun" title="Start před východem" sub="Nahoru jdeš za tmy." value={clock(a.sunrise)} />
          )}
          <Cell
            icon="ground"
            tone={a.wetGround.mm24 >= 20 ? 'nejdi' : a.wetGround.mm24 >= 8 ? 'zvaz' : undefined}
            title="Napršelo za 24 h"
            sub={`${groundLabel(a.wetGround.mm24)} · za 48 h ${num(a.wetGround.mm48, 1)} mm`}
            value={`${num(a.wetGround.mm24, 1)} mm`}
          />
          {maxSnow > 0.02 && (
            <Cell
              icon="snowflake"
              tone={maxSnow >= 0.4 ? 'zvaz' : undefined}
              title="Sníh na trase"
              sub={maxSnow >= 0.3 ? 'Tempo je přepočítané na prošlapávání.' : 'Poprašek ve vyšších polohách.'}
              value={`${Math.round(maxSnow * 100)} cm`}
            />
          )}
          {freezeLow !== null && (
            <Cell
              icon="asterisk"
              tone={freezeLow < top ? 'zvaz' : undefined}
              title="Nulová izoterma"
              sub={freezeLow < top ? 'Nahoře může mrznout, pozor na námrazu.' : 'Nad celou trasou.'}
              value={metres(freezeLow)}
            />
          )}
        </div>
      </Section>

      <Section
        title={`Proč ${plural(a.score.score, 'bod', 'body', 'bodů')}`}
        aside={
          a.score.weakest ? (
            <span className="aside">
              nejslabší {clock(new Date(a.score.weakest.hour.time))}
            </span>
          ) : undefined
        }
        footer="Počítá se z nepříznivé čtvrtiny scénářů ansámblu, ne z nejpravděpodobnější hodnoty."
      >
        <div className="list">
          {breakdown.length === 0 ? (
            <Cell icon="check" tone="jdi" title="Nic body nesebralo" sub="Teplota, vítr, srážky i viditelnost jsou v pohodě." />
          ) : (
            breakdown.map((p) => (
              <div className="cell" key={p.key} data-tone={p.points >= 20 ? 'nejdi' : p.points >= 8 ? 'zvaz' : 'none'}>
                <div className="cell-main" style={{ gap: 8 }}>
                  <div className="between">
                    <span className="cell-title">{p.label}</span>
                    <span className="cell-value">−{Math.round(p.points)}</span>
                  </div>
                  <div className="meter">
                    <i style={{ width: `${Math.min(100, Math.max(3, (p.points / penaltyScale) * 100))}%` }} />
                  </div>
                  <div className="cell-sub">{p.detail}</div>
                </div>
              </div>
            ))
          )}
          {/* Jak se skóre skládá: nejslabší hodina váží víc než průměr. */}
          <div className="cell" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6, paddingTop: breakdown.length === 0 ? 2 : 14 }}>
            <div className="row" style={{ gap: 3 }}>
              <i style={{ flex: 60, height: 8, borderRadius: 4, background: 'var(--ink)' }} />
              <i style={{ flex: 40, height: 8, borderRadius: 4, background: 'var(--line-2)' }} />
            </div>
            <div className="between label" style={{ fontSize: 10.5, letterSpacing: '0.04em' }}>
              <span>60 % nejslabší hodina</span>
              <span>40 % průměr túry</span>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Jistota předpovědi" footer={certaintyFootnote(a, data)}>
        <div className="card card-pad stack" style={{ margin: '0 var(--g)', gap: 14 }}>
          <div className="between" style={{ alignItems: 'flex-end' }}>
            <div className="stack" style={{ gap: 4 }}>
              <span className="cell-title">
                {a.certainty === null
                  ? 'Bez ansámblu'
                  : a.certainty >= 75
                    ? 'Vysoká'
                    : a.certainty >= 50
                      ? 'Střední'
                      : 'Nízká'}
              </span>
              <span className="cell-sub" style={{ maxWidth: 220 }}>
                {vlna(
                  a.certainty === null
                    ? 'Ansámbl se nestáhl, skóre je z jednoho modelu bez rezervy na horší scénář.'
                    : `Mezi příznivým a nepříznivým scénářem se skóre liší o ${plural(Math.round((100 - a.certainty) / 1.4), 'bod', 'body', 'bodů')}.`,
                )}
              </span>
            </div>
            <div className="tile-value" style={{ fontSize: 44 }}>
              {a.certainty === null ? '—' : a.certainty}
              {a.certainty !== null && <small>%</small>}
            </div>
          </div>
          <div className="segs" aria-hidden="true">
            {Array.from({ length: 10 }, (_, i) => (
              <i key={i} data-on={a.certainty !== null && i < Math.round(a.certainty / 10)} />
            ))}
          </div>
        </div>
      </Section>

      <MapSection track={data.track} samples={samples} center={top > 0 ? highestPoint(data.track) : route.waypoints[0]} />

      <p className="footer-note">
        {data.fetchedAt ? `Aktualizováno ${ago(data.fetchedAt)}` : ''}
        {data.forecast ? ` · předpověď pro ${plural(data.forecast.sites.length, 'místo', 'místa', 'míst')} podél trati` : ''}
        {data.track.fallback ? ' · trať se nenašla, počítáno vzdušnou čarou' : ''}
        {data.track.fromGpx ? ' · trať z GPX' : ''}
      </p>
    </>,
  )
}

function IssueRow({ issue }: { issue: Issue }) {
  const tone = issue.severity === 'blok' || issue.bypassed ? 'nejdi' : 'zvaz'
  return (
    <div className="issue" data-tone={tone}>
      <span className="cell-icon" data-tone={tone}>
        <Icon name={ISSUE_ICON[issue.key] ?? 'warn'} size={18} stroke={2} />
      </span>
      <div className="grow">
        <div className="issue-title">{issue.title}</div>
        <div className="issue-meta">
          {issue.place}
          {issue.at ? ` · ${clock(new Date(issue.at))}` : ''}
          {issue.detail ? ` · ${vlna(issue.detail)}` : ''}
        </div>
      </div>
    </div>
  )
}

function Tile({
  icon,
  label,
  value,
  unit,
  note,
  tone,
}: {
  icon: IconName
  label: string
  value: ReactNode
  unit?: string
  note: string
  tone?: 'zvaz' | 'nejdi'
}) {
  return (
    <div className="card tile" data-tone={tone}>
      <div className="tile-label">
        <Icon name={icon} size={16} stroke={1.9} />
        {label}
      </div>
      <div className="tile-value">
        {value}
        {unit && <small>{unit}</small>}
      </div>
      <div className="tile-note">{vlna(note)}</div>
    </div>
  )
}

/** Mapa trasy a pod ní radar v jedné kartě. Radar se stahuje až na požádání. */
function MapSection({
  track,
  samples,
  center,
}: {
  track: NonNullable<RouteData['track']>
  samples: Sample[]
  center: { lat: number; lon: number }
}) {
  const [open, setOpen] = useState(false)
  return (
    <Section title="Mapa" aside={<span className="aside">OpenTopoMap</span>}>
      <div className="card" style={{ margin: '0 var(--g)', overflow: 'hidden' }}>
        <RouteMap track={track} samples={samples} height={196} />
        {open ? (
          <RadarMap track={track} center={center} />
        ) : (
          <Cell icon="radar" tone="rain" title="Srážkový radar" sub="Poslední dvě hodiny, s trasou navrch." chevron onClick={() => setOpen(true)} />
        )}
      </div>
    </Section>
  )
}

function highestPoint(track: NonNullable<RouteData['track']>) {
  return track.points.reduce((a, p) => (p.elevation > a.elevation ? p : a), track.points[0])
}

function visibilityValue(v: number | null): { value: string; unit?: string } {
  if (v === null) return { value: '—' }
  if (v >= 10000) return { value: '10+', unit: 'km' }
  if (v >= 1000) return { value: num(v / 1000, v < 3000 ? 1 : 0), unit: 'km' }
  return { value: String(Math.round(v / 10) * 10), unit: 'm' }
}

/** Co dělá spadlá voda s terénem. */
function groundLabel(mm24: number): string {
  if (mm24 >= 20) return 'rozbahněno, potoky vysoko'
  if (mm24 >= 8) return 'mokré kameny a kořeny'
  if (mm24 >= 2) return 'vlhko, ale schůdné'
  return 'sucho'
}

function certaintyFootnote(a: Assessment, data: RouteData): string {
  const models = data.forecast?.ensembles.map(modelLabel).join(' + ')
  const members = Math.max(0, ...a.samples.map((s) => s.hour.members))
  const spread = `Rozptyl scénářů: teplota ${num(a.spread.temperature, 1)} °C, nárazy ${num(a.spread.windGusts, 0)} km/h, srážky ${num(a.spread.precipitation, 1)} mm.`
  return models ? `${spread} ${models}, ${members} členů.` : spread
}

async function share(route: Route, a: Assessment) {
  const lines = [
    `${route.name} · ${dayLabel(a.start)}`,
    `Start ${clock(a.start)}, návrat ${clock(a.end)} (${duration(a.plan.minutes)})`,
    `${WORD[a.score.verdict].toUpperCase()} · ${a.score.score}/100`,
    ...[...a.score.blockers, ...a.score.warnings].slice(0, 3).map((i) => `– ${i.title} (${i.place}, ${clock(new Date(i.at ?? a.start))})`),
  ]
  const text = lines.join('\n')
  const url = location.origin
  try {
    if (navigator.share) await navigator.share({ title: `NaVrchol: ${route.name}`, text, url })
    else await navigator.clipboard?.writeText(`${text}\n${url}`)
  } catch {
    // Zavřený dialog sdílení není chyba.
  }
}

