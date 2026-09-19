import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { Scroll } from '../components/Scroll'
import { Section } from '../components/Section'
import { Empty, ErrorState, Loading } from '../components/States'
import { compassPoint, sunAzimuths } from '../lib/geo'
import { fetchHorizon, terrainSun, type Horizon, type TerrainSun } from '../lib/horizon'
import { fogSeaAt, haze } from '../lib/inversion'
import { dayLight, milkyWayCore, moonInfo } from '../lib/sun'
import { clock, countdown, dayShort, metres, num, parseDay } from '../lib/format'
import { formatDuration } from '../lib/pace'
import { hourIndex, type Assessment, type DayOutlook } from '../lib/plan'
import type { RouteData } from '../state/useRouteData'
import type { Route, Waypoint } from '../lib/types'

/**
 * Obzor se měří ve vějíři kolem azimutu slunce — kopec o dvacet stupňů vedle
 * je fotografovi k ničemu, ale ten přímo v cestě rozhoduje o všem.
 */
function fanAround(azimuth: number): number[] {
  return [-15, -10, -5, 0, 5, 10, 15].map((d) => (((azimuth + d) % 360) + 360) % 360)
}

/**
 * Aktuální čas, který se sám hlásí každou minutu. Bez něj by odpočet na
 * otevřené obrazovce zamrzl na čase posledního překreslení.
 */
function useMinuteTick(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])
  return now
}

/** Terén kolem nejvyššího bodu trasy. Stáhne se, až když je co počítat. */
function useHorizon(summit: Waypoint, azimuth: number): Horizon | null {
  const [horizon, setHorizon] = useState<Horizon | null>(null)
  const key = `${summit.id}:${Math.round(azimuth / 5) * 5}`

  useEffect(() => {
    let alive = true
    const controller = new AbortController()
    setHorizon(null)
    fetchHorizon(summit, fanAround(azimuth), controller.signal)
      .then((h) => alive && setHorizon(h))
      .catch(() => alive && setHorizon(null))
    return () => {
      alive = false
      controller.abort()
    }
  }, [key])

  return horizon
}

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

  // Obsah je zvlášť, protože stahování terénu je hook a ten se nesmí schovat
  // za podmínku — jinak by se při přepnutí trasy rozešlo pořadí hooků.
  return <SunDetail route={route} data={data} week={week} assessment={assessment} />
}

function SunDetail({
  route,
  data,
  week,
  assessment,
}: {
  route: Route
  data: RouteData
  week: DayOutlook[]
  assessment: Assessment | null
}) {
  const summit = [...route.waypoints].sort((a, b) => b.elevation - a.elevation)[0]

  // Nejlepší představení v týdnu, ať je to východ nebo západ.
  const events = week.flatMap((d) => [
    { day: d, kind: 'vychod' as const, sky: d.sunrise },
    { day: d, kind: 'zapad' as const, sky: d.sunset },
  ])
  const hero = events.reduce((a, b) => (b.sky.score > a.sky.score ? b : a))

  const azimuths = sunAzimuths(summit.lat, hero.sky.at)
  const azimuth = Math.round(hero.kind === 'vychod' ? azimuths.sunrise : azimuths.sunset)

  // Světelná okna, Měsíc a skutečný obzor se nedají stáhnout, počítají se.
  const light = dayLight(summit.lat, summit.lon, hero.sky.at)
  const moon = moonInfo(summit.lat, summit.lon, hero.sky.at)
  const horizon = useHorizon(summit, azimuth)
  const now = useMinuteTick()
  const terrain: TerrainSun | null = horizon
    ? terrainSun(summit, hero.sky.at, horizon, light)
    : null
  const terrainEvent = hero.kind === 'vychod' ? terrain?.sunrise : terrain?.sunset

  // Počasí na vrcholu v tu hodinu — z něj zákal.
  const summitPoint = data.forecast?.points.find((p) => p.waypointId === summit.id)
  const heroHour = summitPoint?.hours[hourIndex(summitPoint.hours, hero.sky.at)] ?? null
  const zakal = heroHour ? haze(heroHour) : null

  // Inverze se neváže na nejhezčí oblohu — je vzácná a stojí za to říct ji
  // kterýkoliv den v týdnu. Hledá se proto přes všechna rána zvlášť.
  const fogDays = week.flatMap((d) => {
    if (!summitPoint) return []
    const at = d.sunrise.at
    const sea = fogSeaAt(summitPoint.hours[hourIndex(summitPoint.hours, at)], summit.elevation)
    return sea ? [{ date: d.date, at, sea }] : []
  })
  const best = fogDays.reduce<(typeof fogDays)[number] | null>((acc, x) => {
    if (!acc) return x
    // Být nad hladinou je víc než silná inverze, ve které stojíš.
    const rank = (y: typeof x) => (y.sea.above ? 1000 : 0) + y.sea.chance
    return rank(x) > rank(acc) ? x : acc
  }, null)
  // Slabá stabilní vrstva je skoro pořád. Sekce má smysl, jen když z ní něco
  // může být — jinak by to byl šum s číslem jedna procento.
  const fogDay = best && best.sea.chance >= 20 ? best : null
  const fog = fogDay?.sea ?? null

  // Zlaté světlo je okno, ne okamžik: nahoře se má stát na jeho začátku.
  const goldenStart =
    hero.kind === 'vychod' ? (light.blueMorning?.from ?? null) : (light.goldenEvening?.from ?? null)
  // Kolik času zabere výstup na nejvyšší bod — z toho vyjde, kdy vyrazit.
  const summitOffsetMin =
    assessment?.plan.arrivals.find((a) => a.waypoint.id === summit.id)?.offsetMin ?? 0
  const beThereAt = new Date(
    Math.min(
      (goldenStart ?? hero.sky.at).getTime(),
      hero.sky.at.getTime() - (hero.kind === 'vychod' ? 20 : 10) * 60000,
    ),
  )
  const leaveAt = new Date(beThereAt.getTime() - summitOffsetMin * 60000)
  const darkNow = milkyWayCore(summit.lat, summit.lon, light.night?.from ?? hero.sky.at)

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

      {terrain?.blocked ? (
        <div className="sec sec--tight" data-tone="nejdi">
          <div className="note">
            <Icon name="warn" size={15} stroke={2} />
            <div>
              Slunce se ten den nad okolní hřebeny vůbec nedostane — z tohohle místa ho
              neuvidíš. Na východ a západ se musí jinam.
            </div>
          </div>
        </div>
      ) : terrainEvent && Math.abs(terrainEvent.delayMin) >= 3 ? (
        <div className="sec sec--tight" data-tone="sun">
          <div className="note">
            <Icon name="peak" size={15} stroke={2} />
            <div>
              Za terénem {hero.kind === 'vychod' ? 'vyleze' : 'zapadne'} v{' '}
              <strong className="mono">{clock(terrainEvent.at)}</strong>, tedy o{' '}
              {Math.abs(terrainEvent.delayMin)} min {terrainEvent.delayMin > 0 ? 'později' : 'dřív'}{' '}
              než podle tabulky.
              {terrainEvent.blocker && terrainEvent.delayMin > 0
                ? ` Drží ho hřeben ${metres(terrainEvent.blocker.elevation)} ve ${num(terrainEvent.blocker.distanceKm, 1)} km.`
                : ' Z vrcholu je vidět za obzor.'}
            </div>
          </div>
        </div>
      ) : null}

      <div className="sec sec--tight">
        <div className="frame">
          <SkyVisual layers={hero.sky.layers} azimuth={azimuth} />
        </div>
        <p className="body" style={{ marginTop: 10 }}>
          {hero.sky.reason}
        </p>
      </div>

      {fog && (
        <Section
          label="Moře mlhy"
          meta={
            <span
              data-tone={fog.above && fog.chance >= 60 ? 'jdi' : fog.chance >= 30 ? 'zvaz' : 'none'}
              style={{ color: 'var(--tone)', fontWeight: 600, fontSize: 12 }}
            >
              {fogDay ? `${dayShort(parseDay(fogDay.date))} · ` : ''}
              {fog.chance} %
            </span>
          }
        >
          <div className="rows">
            <div className="row">
              <span className="label row-key">Hladina mlhy</span>
              <span className="hint truncate" style={{ flexGrow: 1 }}>
                inverze {fog.strengthK > 0 ? '+' : ''}
                {num(fog.strengthK, 1)} °C
              </span>
              <span className="row-value">{metres(fog.topM)}</span>
            </div>
            <div className="row" data-tone={fog.above ? 'jdi' : 'zvaz'}>
              <span className="label row-key">Ty</span>
              <span className="hint truncate" style={{ flexGrow: 1 }}>
                {summit.name}, {metres(summit.elevation)}
              </span>
              <span className="row-value" style={{ color: 'var(--tone)' }}>
                {fog.above ? `${metres(summit.elevation - fog.topM)} nad` : 'uvnitř'}
              </span>
            </div>
          </div>
          <p className="footnote" style={{ marginTop: 12 }}>
            {fog.reason} Počítáno k východu slunce
            {fogDay ? ` ${dayShort(parseDay(fogDay.date))} v ${clock(fogDay.at)}` : ''} — přes den
            se inverze obvykle rozpustí.
          </p>
        </Section>
      )}

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

      <Section label="Světlo" meta={dayShort(parseDay(hero.day.date))}>
        <div className="rows">
          <LightRow label="Modrá hodina" window={light.blueMorning} note="před východem" />
          <LightRow label="Zlaté ráno" window={light.goldenMorning} note="po východu" />
          <LightRow label="Zlatý večer" window={light.goldenEvening} note="před západem" />
          <LightRow label="Modrý večer" window={light.blueEvening} note="po západu" />
        </div>
        <p className="footnote" style={{ marginTop: 12 }}>
          Zlatá hodina není hodina: v prosinci trvá skoro sedmdesát minut, protože slunce
          leze nad obzor šikmo, v červnu je o třetinu kratší. Modrá končí východem
          a začíná západem.
        </p>
      </Section>

      <div className="sec sec--tight" data-tone="sun">
        <div className="note">
          <Icon name="clock" size={15} stroke={2} />
          <div>
            Vyraž v <strong className="mono">{clock(leaveAt)}</strong>, nahoře buď v{' '}
            <strong className="mono">{clock(beThereAt)}</strong> — to začíná{' '}
            {hero.kind === 'vychod' ? 'modrá hodina' : 'zlaté světlo'}
            {summitOffsetMin > 0 ? `, výstup ti zabere ${formatDuration(summitOffsetMin)}.` : '.'}
            {countdown(now, leaveAt, hero.sky.at) ? ` ${countdown(now, leaveAt, hero.sky.at)}` : ''}
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

      <Section label="Noc" meta={`${moon.label} ${moon.brightness} %`}>
        <div className="rows">
          <div className="row">
            <span className="label row-key">Měsíc</span>
            <span className="hint truncate" style={{ flexGrow: 1 }}>
              {moon.rise ? `vychází ${clock(moon.rise)}` : 'ten den nevychází'}
              {moon.set ? ` · zapadá ${clock(moon.set)}` : ''}
            </span>
            <span className="row-value">{moon.brightness} %</span>
          </div>
          <div className="row">
            <span className="label row-key">Tma</span>
            <span className="hint truncate" style={{ flexGrow: 1 }}>
              {light.night ? 'astronomický soumrak až svítání' : 'v tuhle roční dobu se úplně nesetmí'}
            </span>
            <span className="row-value">
              {light.night ? `${clock(light.night.from)}—${clock(light.night.to)}` : '—'}
            </span>
          </div>
        </div>
        <p className="footnote" style={{ marginTop: 12 }}>
          {moon.brightness > 60
            ? 'Měsíc v úplňku přesvítí hvězdy — na Mléčnou dráhu si počkej na ubývající.'
            : darkNow.altitude > 3
              ? `Jádro Mléčné dráhy je v tu dobu ${Math.round(darkNow.altitude)}° nad obzorem na azimutu ${Math.round(darkNow.azimuth)}° (${compassPoint(darkNow.azimuth)}). Z padesáté rovnoběžky výš nevyleze.`
              : 'Jádro Mléčné dráhy je v tu dobu pod obzorem — na tuhle fotku je pozdě v roce.'}
        </p>
      </Section>

      <Section label="Počítej navíc s">
        <p className="body">
          Slunce {hero.kind === 'vychod' ? 'vychází' : 'zapadá'} na azimutu{' '}
          <span className="mono">{azimuth}°</span> ({compassPoint(azimuth)}).
          {hero.kind === 'vychod'
            ? ' Nahoru jdeš za tmy — čelovka s náhradní baterií, termoska a rukavice navíc.'
            : ' Dolů půjdeš za tmy — čelovka s náhradní baterií a půlhodina rezervy.'}
        </p>
        {zakal && (
          <p className="body" style={{ marginTop: 10 }}>
            Zákal: {zakal.label} — vrstvy hřebenů čitelné zhruba do{' '}
            <span className="mono">{zakal.rangeKm} km</span>. Na dálky rozhoduje aerosol v celém
            sloupci, ne přízemní dohlednost.
          </p>
        )}
      </Section>
    </Scroll>
  )
}

function LightRow({
  label,
  window,
  note,
}: {
  label: string
  window: { from: Date; to: Date } | null
  note: string
}) {
  const minutes = window ? Math.round((window.to.getTime() - window.from.getTime()) / 60000) : 0
  return (
    <div className="row">
      <span className="label row-key" style={{ width: 96 }}>
        {label}
      </span>
      <span className="hint truncate" style={{ flexGrow: 1 }}>
        {window ? `${note}, ${minutes} min` : 'ten den nenastane'}
      </span>
      <span className="row-value mono">
        {window ? `${clock(window.from)}—${clock(window.to)}` : '—'}
      </span>
    </div>
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
