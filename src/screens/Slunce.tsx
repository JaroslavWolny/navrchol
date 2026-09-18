import { Icon } from '../components/Icon'
import { Empty, ErrorState, Loading } from '../components/States'
import { compassPoint, sunAzimuths } from '../lib/geo'
import { clock, dayShort, parseDay } from '../lib/format'
import { formatDuration } from '../lib/pace'
import type { DayOutlook } from '../lib/plan'
import type { Assessment } from '../lib/plan'
import type { RouteData } from '../state/useRouteData'
import type { Route } from '../lib/types'

const GOOD = 'var(--sun)'
const MID = 'oklch(0.74 0.09 90)'
const POOR = 'oklch(0.52 0.03 255)'
const colorOf = (s: number) => (s >= 65 ? GOOD : s >= 35 ? MID : POOR)

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
  if (!week) return <div className="scroll"><Loading what="Počítám barevnost oblohy…" /></div>

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
    <div className="scroll">
      <div className="pad" style={{ paddingTop: 22 }}>
        <h1 className="page-title">Východ a západ</h1>
        <div className="sub" style={{ marginTop: 6 }}>
          {route.name} · barevnost oblohy na {week.length} dní
        </div>
      </div>

      <div className="pad" style={{ marginTop: 14 }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="row-between" style={{ padding: '13px 15px 11px' }}>
            <div className="stack" style={{ gap: 3 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: GOOD }}>
                NEJLEPŠÍ {hero.kind === 'vychod' ? 'VÝCHOD' : 'ZÁPAD'} V TÝDNU
              </div>
              <div className="disp" style={{ fontSize: 21, fontWeight: 800 }}>
                {dayShort(parseDay(hero.day.date))} · {clock(hero.sky.at)}
              </div>
            </div>
            <div className="stack" style={{ alignItems: 'flex-end' }}>
              <div className="mono" style={{ fontSize: 32, fontWeight: 700, lineHeight: 1, color: colorOf(hero.sky.score) }}>
                {hero.sky.score}
              </div>
              <div
                className="mono"
                style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: colorOf(hero.sky.score), textTransform: 'uppercase' }}
              >
                {hero.sky.label}
              </div>
            </div>
          </div>

          <SkyVisual layers={hero.sky.layers} azimuth={azimuth} />

          <div style={{ padding: '12px 15px 4px', display: 'flex', flexDirection: 'column', gap: 7 }}>
            <LayerBar name="vysoká 8—12 km" pct={hero.sky.layers.high} color={GOOD} />
            <LayerBar name="střední 3—6 km" pct={hero.sky.layers.mid} color={MID} />
            <LayerBar name="nízká do 2 km" pct={hero.sky.layers.low} color={POOR} />
            <div style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--dim)', paddingTop: 3, textWrap: 'pretty' }}>
              {hero.sky.reason}
            </div>
          </div>

          <div
            style={{
              margin: '10px 12px 12px',
              padding: '10px 12px',
              borderRadius: 12,
              background: 'var(--sun-wash)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Icon name="clock" size={17} stroke={2} color={GOOD} />
            <div style={{ fontSize: 12.5, lineHeight: 1.4 }}>
              Vyraž v <strong className="mono">{clock(leaveAt)}</strong>, nahoře buď v{' '}
              <strong className="mono">{clock(beThereAt)}</strong>
              {summitOffsetMin > 0 ? ` — výstup ti zabere ${formatDuration(summitOffsetMin)}.` : '.'}
            </div>
          </div>
        </div>
      </div>

      <div className="pad" style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, paddingBottom: 5 }}>
          <span style={{ width: 44, flexShrink: 0 }} />
          <span style={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="sunrise" size={13} stroke={2} color="var(--mute)" />
            <span className="section-label">VÝCHOD</span>
          </span>
          <span style={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="sunset" size={13} stroke={2} color="var(--mute)" />
            <span className="section-label">ZÁPAD</span>
          </span>
        </div>

        <div className="stack" style={{ gap: 4 }}>
          {week.map((day) => {
            const isHero = day.date === hero.day.date
            return (
              <div
                key={day.date}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: '6px 10px',
                  borderRadius: 11,
                  background: isHero ? 'var(--sun-wash)' : 'var(--card-2)',
                }}
              >
                <span
                  className="mono"
                  style={{ width: 44, fontSize: 11, fontWeight: 700, color: isHero ? 'var(--fg)' : 'var(--dim)' }}
                >
                  {dayShort(parseDay(day.date))}
                </span>
                <EventCell at={day.sunrise.at} score={day.sunrise.score} />
                <EventCell at={day.sunset.at} score={day.sunset.score} />
              </div>
            )
          })}
        </div>
      </div>

      <div className="pad" style={{ marginTop: 14 }}>
        <div
          style={{
            padding: '11px 13px',
            borderRadius: 13,
            background: 'var(--acc-wash)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
          }}
        >
          <Icon name="vybava" size={17} stroke={2} color="var(--acc)" style={{ marginTop: 1 }} />
          <div className="stack" style={{ gap: 3 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--acc)' }}>Počítej navíc s</div>
            <div style={{ fontSize: 12, lineHeight: 1.45, textWrap: 'pretty' }}>
              Slunce {hero.kind === 'vychod' ? 'vychází' : 'zapadá'} na azimutu {azimuth}° ({compassPoint(azimuth)}).
              {hero.kind === 'vychod'
                ? ' Nahoru jdeš za tmy — čelovka s náhradní baterií, termoska a rukavice navíc.'
                : ' Dolů půjdeš za tmy — čelovka s náhradní baterií a půlhodina rezervy.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function EventCell({ at, score }: { at: Date; score: number }) {
  return (
    <span style={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
      <span className="mono" style={{ fontSize: 11.5, color: 'var(--dim)' }}>{clock(at)}</span>
      <span style={{ flexGrow: 1, height: 5, borderRadius: 3, background: 'var(--card-3)', overflow: 'hidden' }}>
        <span style={{ display: 'block', width: `${score}%`, height: '100%', borderRadius: 3, background: colorOf(score) }} />
      </span>
      <span className="mono" style={{ width: 20, textAlign: 'right', fontSize: 12, fontWeight: 700, color: colorOf(score) }}>
        {score}
      </span>
    </span>
  )
}

function LayerBar({ name, pct, color }: { name: string; pct: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <span className="mono" style={{ width: 92, flexShrink: 0, fontSize: 10, color: 'var(--dim)' }}>{name}</span>
      <span style={{ flexGrow: 1, height: 6, borderRadius: 3, background: 'var(--card-3)', overflow: 'hidden' }}>
        <span style={{ display: 'block', width: `${pct}%`, height: '100%', borderRadius: 3, background: color }} />
      </span>
      <span className="mono" style={{ width: 32, textAlign: 'right', fontSize: 11, fontWeight: 700 }}>{pct} %</span>
    </div>
  )
}

/** Obzor s oblačností po vrstvách — ukazuje přesně to, z čeho se skóre počítá. */
function SkyVisual({ layers, azimuth }: { layers: { high: number; mid: number; low: number }; azimuth: number }) {
  const band = (y: number, h: number, cover: number, opacity: number) =>
    cover < 2 ? null : (
      <g opacity={opacity * Math.min(1, cover / 60)}>
        <rect x={26} y={y} width={96 + cover} height={h} rx={h / 2} fill="oklch(0.95 0.06 70)" />
        <rect x={150 + cover * 0.4} y={y + h + 3} width={120} height={h} rx={h / 2} fill="oklch(0.95 0.06 70)" />
      </g>
    )

  return (
    <svg viewBox="0 12 358 92" style={{ display: 'block', width: '100%' }} aria-hidden="true">
      <defs>
        <linearGradient id="skygrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.26 0.075 268)" />
          <stop offset="46%" stopColor="oklch(0.48 0.12 30)" />
          <stop offset="100%" stopColor="oklch(0.80 0.15 66)" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="358" height="104" fill="url(#skygrad)" />
      {band(14, 4.5, layers.high, 0.5)}
      {band(46, 7, layers.mid, 0.3)}
      {band(68, 6, layers.low, 0.55)}
      <circle cx="186" cy="84" r="15" fill="oklch(0.94 0.14 80)" opacity="0.92" />
      <path
        d="M0 92 L38 80 L64 88 L104 70 L138 84 L172 76 L206 86 L246 66 L286 84 L318 76 L358 88 L358 104 L0 104 Z"
        fill="oklch(0.19 0.02 260)"
      />
      <text
        x="12"
        y="100"
        fontSize="9"
        fontWeight="700"
        letterSpacing="1.2"
        fill="oklch(0.80 0.03 70)"
        fontFamily="JetBrains Mono, monospace"
        opacity="0.8"
      >
        AZIMUT {azimuth}°
      </text>
    </svg>
  )
}
