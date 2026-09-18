import { Icon } from '../components/Icon'
import { Scroll } from '../components/Scroll'
import { Section } from '../components/Section'
import { Empty, ErrorState, Loading } from '../components/States'
import { compassPoint, sunAzimuths } from '../lib/geo'
import { clock, dayShort, parseDay } from '../lib/format'
import { formatDuration } from '../lib/pace'
import type { Assessment, DayOutlook } from '../lib/plan'
import type { RouteData } from '../state/useRouteData'
import type { Route } from '../lib/types'

const MID = 'oklch(0.72 0.075 80)'
const POOR = 'oklch(0.50 0.02 160)'
const colorOf = (s: number) => (s >= 65 ? 'var(--sun)' : s >= 35 ? MID : POOR)

interface Props {
  route: Route | null
  data: RouteData
  week: DayOutlook[] | null
  assessment: Assessment | null
}

export function SlunceScreen({ route, data, week, assessment }: Props) {
  if (!route || route.waypoints.length < 2) {
    return (
      <div className="scroll">
        <Empty title="Žádná trasa" hint="Vyber trasu a spočítám, kdy tam bude stát za to být na východ nebo západ." />
      </div>
    )
  }
  if (data.error) return <div className="scroll"><ErrorState message={data.error} onRetry={data.reload} /></div>
  if (!week) return <div className="scroll"><Loading what="počítám barevnost oblohy" /></div>

  const summit = [...route.waypoints].sort((a, b) => b.elevation - a.elevation)[0]

  // Nejlepší představení v týdnu, ať je to východ nebo západ.
  const events = week.flatMap((d) => [
    { day: d, kind: 'vychod' as const, sky: d.sunrise },
    { day: d, kind: 'zapad' as const, sky: d.sunset },
  ])
  const hero = events.reduce((a, b) => (b.sky.score > a.sky.score ? b : a))

  const azimuths = sunAzimuths(summit.lat, hero.sky.at)
  const azimuth = Math.round(hero.kind === 'vychod' ? azimuths.sunrise : azimuths.sunset)

  // Kolik času zabere výstup na nejvyšší bod — z toho vyjde, kdy vyrazit.
  const summitOffsetMin =
    assessment?.plan.arrivals.find((a) => a.waypoint.id === summit.id)?.offsetMin ?? 0
  const beThereAt = new Date(hero.sky.at.getTime() - (hero.kind === 'vychod' ? 20 : 10) * 60000)
  const leaveAt = new Date(beThereAt.getTime() - summitOffsetMin * 60000)

  return (
    <Scroll onRefresh={data.reload} refreshing={data.loading}>
      <header className="masthead">
        <h1>Východ a západ</h1>
        <div className="meta">{route.name} · barevnost oblohy na {week.length} dní</div>
      </header>

      <div className="sec" style={{ marginTop: 18 }} data-tone="sun">
        <div className="pick" style={{ cursor: 'default' }}>
          <div className="pick-head">
            <div>
              <div className="label" style={{ color: 'var(--tone)' }}>
                Nejlepší {hero.kind === 'vychod' ? 'východ' : 'západ'} v týdnu
              </div>
              <div className="pick-when">
                {dayShort(parseDay(hero.day.date))} · {clock(hero.sky.at)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="pick-score">{hero.sky.score}</div>
              <div className="label" style={{ color: 'var(--tone)', marginTop: 2 }}>
                {hero.sky.label}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="sec sec--tight">
        <div className="frame">
          <SkyVisual layers={hero.sky.layers} azimuth={azimuth} />
        </div>
        <p className="body" style={{ marginTop: 10 }}>
          {hero.sky.reason}
        </p>
      </div>

      <Section label="Oblačnost po vrstvách">
        <div className="rows">
          <LayerRow name="Vysoká" note="8—12 km" pct={hero.sky.layers.high} color="var(--sun)" />
          <LayerRow name="Střední" note="3—6 km" pct={hero.sky.layers.mid} color={MID} />
          <LayerRow name="Nízká" note="do 2 km" pct={hero.sky.layers.low} color={POOR} />
        </div>
        <p className="footnote" style={{ marginTop: 12 }}>
          Vysoká chytá barvu, ideál je kolem 45 %. Nízká cloní obzor a představení zruší bez
          ohledu na to, co je nad ní.
        </p>
      </Section>

      <div className="sec sec--tight" data-tone="sun">
        <div className="note">
          <Icon name="clock" size={15} stroke={2} />
          <div>
            Vyraž v <strong className="mono">{clock(leaveAt)}</strong>, nahoře buď v{' '}
            <strong className="mono">{clock(beThereAt)}</strong>
            {summitOffsetMin > 0 ? ` — výstup ti zabere ${formatDuration(summitOffsetMin)}.` : '.'}
          </div>
        </div>
      </div>

      <Section label="Podle dnů" meta="východ · západ">
        <div className="rows">
          {week.map((day) => {
            const isHero = day.date === hero.day.date
            return (
              <div className="row" key={day.date}>
                <span
                  className="mono"
                  style={{
                    width: 48,
                    flexShrink: 0,
                    fontSize: 11.5,
                    fontWeight: isHero ? 600 : 400,
                    color: isHero ? 'var(--paper)' : 'var(--paper-3)',
                  }}
                >
                  {dayShort(parseDay(day.date))}
                </span>
                <EventCell at={day.sunrise.at} score={day.sunrise.score} />
                <EventCell at={day.sunset.at} score={day.sunset.score} />
              </div>
            )
          })}
        </div>
      </Section>

      <Section label="Počítej navíc s">
        <p className="body">
          Slunce {hero.kind === 'vychod' ? 'vychází' : 'zapadá'} na azimutu{' '}
          <span className="mono">{azimuth}°</span> ({compassPoint(azimuth)}).
          {hero.kind === 'vychod'
            ? ' Nahoru jdeš za tmy — čelovka s náhradní baterií, termoska a rukavice navíc.'
            : ' Dolů půjdeš za tmy — čelovka s náhradní baterií a půlhodina rezervy.'}
        </p>
      </Section>
    </Scroll>
  )
}

function EventCell({ at, score }: { at: Date; score: number }) {
  return (
    <span style={{ flexGrow: 1, flexBasis: 0, display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
      <span className="mono" style={{ fontSize: 11.5, color: 'var(--paper-3)' }}>
        {clock(at)}
      </span>
      <span className="bar" style={{ flexGrow: 1, minWidth: 0 }}>
        <span style={{ width: `${score}%`, background: colorOf(score) }} />
      </span>
      <span className="mono" style={{ width: 20, textAlign: 'right', fontSize: 12, color: colorOf(score) }}>
        {score}
      </span>
    </span>
  )
}

function LayerRow({ name, note, pct, color }: { name: string; note: string; pct: number; color: string }) {
  return (
    <div className="row">
      <span className="label row-key" style={{ width: 66 }}>
        {name}
      </span>
      <span className="hint" style={{ width: 66, flexShrink: 0 }}>
        {note}
      </span>
      <span className="bar" style={{ flexGrow: 1, minWidth: 0 }}>
        <span style={{ width: `${pct}%`, background: color }} />
      </span>
      <span className="row-value" style={{ width: 40, textAlign: 'right', fontSize: 13 }}>
        {pct} %
      </span>
    </div>
  )
}

/** Obzor s oblačností po vrstvách — ukazuje přesně to, z čeho se skóre počítá. */
function SkyVisual({ layers, azimuth }: { layers: { high: number; mid: number; low: number }; azimuth: number }) {
  const band = (y: number, h: number, cover: number, opacity: number) =>
    cover < 2 ? null : (
      <g opacity={opacity * Math.min(1, cover / 60)}>
        <rect x={26} y={y} width={96 + cover} height={h} fill="oklch(0.95 0.06 70)" />
        <rect x={150 + cover * 0.4} y={y + h + 3} width={120} height={h} fill="oklch(0.95 0.06 70)" />
      </g>
    )

  return (
    <svg viewBox="0 12 358 92" style={{ display: 'block', width: '100%' }} aria-hidden="true">
      <defs>
        <linearGradient id="skygrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.24 0.06 265)" />
          <stop offset="46%" stopColor="oklch(0.46 0.115 32)" />
          <stop offset="100%" stopColor="oklch(0.79 0.145 66)" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="358" height="104" fill="url(#skygrad)" />
      {band(14, 4.5, layers.high, 0.5)}
      {band(46, 7, layers.mid, 0.3)}
      {band(68, 6, layers.low, 0.55)}
      <circle cx="186" cy="84" r="15" fill="oklch(0.94 0.14 80)" opacity="0.92" />
      <path
        d="M0 92 L38 80 L64 88 L104 70 L138 84 L172 76 L206 86 L246 66 L286 84 L318 76 L358 88 L358 104 L0 104 Z"
        fill="oklch(0.17 0.006 160)"
      />
      <text
        x="10"
        y="100"
        fontSize="9"
        fontWeight="500"
        letterSpacing="1.4"
        fill="oklch(0.80 0.03 70)"
        fontFamily="IBM Plex Mono, monospace"
      >
        AZIMUT {azimuth}°
      </text>
    </svg>
  )
}
