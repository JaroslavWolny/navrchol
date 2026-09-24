import { useEffect, useId, useState, type ReactNode } from 'react'
import { Icon } from '../components/Icon'
import { Screen } from '../components/Screen'
import { Cell, Section } from '../components/ui'
import { Empty, ErrorState, Loading } from '../components/States'
import { compassPoint, sunAzimuths } from '../lib/geo'
import { fetchHorizon, terrainSun, type Horizon, type TerrainSun } from '../lib/horizon'
import { fogSeaAt, haze } from '../lib/inversion'
import { dayLight, milkyWayCore, moonInfo, type LightWindow } from '../lib/sun'
import { capital, clock, countdown, dayLabel, duration, metres, num, parseDay, signed, vlna } from '../lib/format'
import { hourIndex, summitHours, type Assessment, type DayOutlook } from '../lib/plan'
import type { SkyScore } from '../lib/sky'
import type { RouteData } from '../state/useRouteData'
import type { Route } from '../lib/types'

/**
 * Obzor se měří ve vějíři kolem azimutu slunce — kopec o dvacet stupňů vedle
 * je fotografovi k ničemu, ale ten přímo v cestě rozhoduje o všem.
 */
function fanAround(azimuth: number): number[] {
  return [-15, -10, -5, 0, 5, 10, 15].map((d) => (((azimuth + d) % 360) + 360) % 360)
}

/** Aktuální čas, který se sám hlásí každou minutu — kvůli odpočtu. */
function useMinuteTick(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])
  return now
}

/** Terén kolem nejvyššího bodu trasy. Stáhne se, až když je co počítat. */
function useHorizon(summit: { lat: number; lon: number; elevation: number }, azimuth: number): Horizon | null {
  const [horizon, setHorizon] = useState<Horizon | null>(null)
  const key = `${summit.lat},${summit.lon}:${Math.round(azimuth / 5) * 5}`

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return horizon
}

const skyTone = (s: number) => (s >= 65 ? 'jdi' : s >= 35 ? 'zvaz' : 'none')

interface Props {
  route: Route | null
  data: RouteData
  week: DayOutlook[] | null
  assessment: Assessment | null
}

export function SlunceScreen({ route, data, week, assessment }: Props) {
  if (!route || route.waypoints.length < 2) {
    return (
      <Screen title="Slunce">
        <Empty icon="slunce" title="Žádná trasa" hint="Vyber trasu a appka spočítá, kdy nahoře stojí za to být na východ nebo západ." />
      </Screen>
    )
  }
  if (data.error) return <Screen title="Slunce"><ErrorState message={data.error} onRetry={data.reload} /></Screen>
  if (!week || !data.track || !data.forecast) {
    return <Screen title="Slunce"><Loading what="Počítám barevnost oblohy" /></Screen>
  }
  const summit = summitHours(data.track, data.forecast)
  if (!summit) return <Screen title="Slunce"><ErrorState message="Pro vrchol nedorazila předpověď." onRetry={data.reload} /></Screen>

  // Obsah je zvlášť, protože stahování terénu je hook a ten se nesmí schovat
  // za podmínku — jinak by se při přepnutí trasy rozešlo pořadí hooků.
  return <SunDetail route={route} data={data} week={week} assessment={assessment} summit={summit} />
}

function SunDetail({
  route,
  data,
  week,
  assessment,
  summit,
}: {
  route: Route
  data: RouteData
  week: DayOutlook[]
  assessment: Assessment | null
  summit: NonNullable<ReturnType<typeof summitHours>>
}) {
  const site = summit.site
  const top = [...route.waypoints].sort((a, b) => b.elevation - a.elevation)[0]
  const name = top?.name ?? route.name
  // Výška trati je z modelu terénu; u vrcholu, který si člověk pojmenoval, platí jeho výška.
  const shownElevation = top && Math.abs(top.elevation - site.elevation) < 60 ? top.elevation : site.elevation

  // Nejlepší představení v týdnu, ať je to východ nebo západ.
  const events = week.flatMap((d) => [
    { day: d, kind: 'vychod' as const, sky: d.sunrise },
    { day: d, kind: 'zapad' as const, sky: d.sunset },
  ])
  const upcoming = events.filter((e) => e.sky.at.getTime() > Date.now())
  const hero = (upcoming.length ? upcoming : events).reduce((a, b) => (b.sky.score > a.sky.score ? b : a))
  const isRise = hero.kind === 'vychod'

  const azimuths = sunAzimuths(site.lat, hero.sky.at)
  const azimuth = Math.round(isRise ? azimuths.sunrise : azimuths.sunset)

  // Světelná okna, Měsíc a skutečný obzor se nedají stáhnout, počítají se.
  const light = dayLight(site.lat, site.lon, hero.sky.at)
  const moon = moonInfo(site.lat, site.lon, hero.sky.at)
  const horizon = useHorizon(site, azimuth)
  const now = useMinuteTick()
  const terrain: TerrainSun | null = horizon ? terrainSun(site, hero.sky.at, horizon, light) : null
  const terrainEvent = isRise ? terrain?.sunrise : terrain?.sunset

  const heroHour = summit.hours[hourIndex(summit.hours, hero.sky.at)] ?? null
  const zakal = heroHour ? haze(heroHour) : null

  // Inverze se neváže na nejhezčí oblohu — je vzácná a stojí za to říct ji
  // kterýkoliv den v týdnu. Hledá se proto přes všechna rána zvlášť.
  const fogDays = week.flatMap((d) => {
    const at = d.sunrise.at
    const sea = fogSeaAt(summit.hours[hourIndex(summit.hours, at)], site.elevation)
    return sea ? [{ date: d.date, at, sea }] : []
  })
  const bestFog = fogDays.reduce<(typeof fogDays)[number] | null>((acc, x) => {
    if (!acc) return x
    const rank = (y: typeof x) => (y.sea.above ? 1000 : 0) + y.sea.chance
    return rank(x) > rank(acc) ? x : acc
  }, null)
  // Slabá stabilní vrstva je skoro pořád. Sekce má smysl, jen když z ní něco může být.
  const fogDay = bestFog && bestFog.sea.chance >= 20 ? bestFog : null

  // Zlaté světlo je okno, ne okamžik: nahoře se má stát na jeho začátku.
  const windowStart = isRise ? (light.blueMorning?.from ?? null) : (light.goldenEvening?.from ?? null)
  const summitOffsetMin = (() => {
    if (!assessment) return 0
    const top = [...assessment.plan.arrivals].sort((a, b) => b.waypoint.elevation - a.waypoint.elevation)[0]
    return top?.offsetMin ?? 0
  })()
  const beThereAt = new Date(
    Math.min((windowStart ?? hero.sky.at).getTime(), hero.sky.at.getTime() - (isRise ? 20 : 10) * 60000),
  )
  const leaveAt = new Date(beThereAt.getTime() - summitOffsetMin * 60000)
  const darkNow = milkyWayCore(site.lat, site.lon, light.night?.from ?? hero.sky.at)
  const count = countdown(now, leaveAt, hero.sky.at)

  return (
    <Screen
      title="Slunce"
      subtitle={`${name}, ${metres(shownElevation)} · ${week.length} dní dopředu`}
      onRefresh={data.reload}
      refreshing={data.loading}
    >
      <div className="page mt-12">
        <div className="card" style={{ overflow: 'hidden' }}>
          <SkyVisual layers={hero.sky.layers} rise={isRise} azimuth={azimuth} />
          <div className="card-pad">
            <div className="between" style={{ alignItems: 'flex-start' }}>
              <div>
                <div className="t-foot muted" style={{ fontWeight: 600 }}>
                  Nejlepší {isRise ? 'východ' : 'západ'} v týdnu
                </div>
                <div className="t-title mt-4">
                  {capital(dayLabel(hero.sky.at))}, {clock(hero.sky.at)}
                </div>
              </div>
              <div className="score" data-tone={skyTone(hero.sky.score)}>
                <b style={{ color: 'var(--tone)' }}>{hero.sky.score}</b>
                <span>{hero.sky.label}</span>
              </div>
            </div>
            <p className="t-sub muted mt-8">{vlna(hero.sky.reason)}</p>
            <div className="banner mt-12" data-tone="sun" style={{ margin: 0 }}>
              <Icon name="walk" size={18} stroke={2} />
              <span>
                Vyraž v <b>{clock(leaveAt)}</b>, nahoře buď v <b>{clock(beThereAt)}</b>
                {summitOffsetMin > 0 ? ` (výstup ${duration(summitOffsetMin)})` : ''}.{count ? ` ${count}` : ''}
              </span>
            </div>
          </div>
        </div>
      </div>

      {terrain?.blocked ? (
        <div className="banner mt-12" data-tone="nejdi">
          <Icon name="mountain" size={18} stroke={2} />
          Slunce se ten den nad okolní hřebeny nedostane. Na {isRise ? 'východ' : 'západ'} se musí jinam.
        </div>
      ) : terrainEvent && Math.abs(terrainEvent.delayMin) >= 3 ? (
        <div className="banner mt-12" data-tone="sun">
          <Icon name="mountain" size={18} stroke={2} />
          <span>
            Za terénem {isRise ? 'vyleze' : 'zapadne'} v <b>{clock(terrainEvent.at)}</b>, o {Math.abs(terrainEvent.delayMin)} min{' '}
            {terrainEvent.delayMin > 0 ? 'později' : 'dřív'} než podle tabulek.
            {terrainEvent.blocker && terrainEvent.delayMin > 0
              ? ` Drží ho hřeben ${metres(terrainEvent.blocker.elevation)} ve vzdálenosti ${num(terrainEvent.blocker.distanceKm, 1)} km.`
              : ' Z\u00a0vrcholu vidíš za obzor.'}
          </span>
        </div>
      ) : null}

      <Section title="Světlo" aside={<span className="aside">{capital(dayLabel(hero.sky.at))}</span>}>
        <div className="card card-pad" style={{ margin: '0 var(--g)' }}>
          <LightBar light={light} />
        </div>
        <div className="list mt-12">
          <LightCell icon="sunrise" label="Modrá hodina" window={light.blueMorning} />
          <LightCell icon="sun" label="Zlaté ráno" window={light.goldenMorning} />
          <LightCell icon="sun" label="Zlatý večer" window={light.goldenEvening} />
          <LightCell icon="sunset" label="Modrý večer" window={light.blueEvening} />
        </div>
      </Section>

      <Section
        title="Oblačnost"
        footer="Vysoká oblačnost chytá barvu, ideál je kolem 45 %. Nízká cloní obzor a představení zruší bez ohledu na to, co je nad ní."
      >
        <div className="list">
          <LayerCell name="Vysoká" note="8–12 km" pct={hero.sky.layers.high} />
          <LayerCell name="Střední" note="3–6 km" pct={hero.sky.layers.mid} />
          <LayerCell name="Nízká" note="do 2 km" pct={hero.sky.layers.low} />
        </div>
      </Section>

      {fogDay && (
        <Section
          title="Moře mlhy"
          aside={<span className="aside">{capital(dayLabel(parseDay(fogDay.date)))} ráno</span>}
          footer={`${fogDay.sea.reason} Počítáno k východu slunce v ${clock(fogDay.at)}, přes den se inverze obvykle rozpustí.`}
        >
          <div className="list">
            <Cell
              icon="layers"
              tone={fogDay.sea.chance >= 60 ? 'jdi' : fogDay.sea.chance >= 30 ? 'zvaz' : 'none'}
              title="Šance"
              sub={`inverze ${signed(fogDay.sea.strengthK, 1)} °C`}
              value={`${fogDay.sea.chance} %`}
            />
            <Cell icon="mountain" title="Hladina mlhy" value={metres(fogDay.sea.topM)} />
            <Cell
              icon="flag"
              tone={fogDay.sea.above ? 'jdi' : 'zvaz'}
              title={name}
              sub={fogDay.sea.above ? 'Budeš nad mlhou.' : 'Budeš uvnitř mlhy.'}
              value={fogDay.sea.above ? `${metres(site.elevation - fogDay.sea.topM)} nad` : 'uvnitř'}
            />
          </div>
        </Section>
      )}

      <Section title="Podle dnů">
        <div className="list">
          {week.map((d) => (
            <div className="cell" key={d.date}>
              <span className="cell-title" style={{ width: 88, flexShrink: 0 }}>
                {capital(dayLabel(parseDay(d.date)))}
              </span>
              <SkyBadge icon="sunrise" at={d.sunrise.at} sky={d.sunrise} />
              <SkyBadge icon="sunset" at={d.sunset.at} sky={d.sunset} />
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Noc"
        footer={
          moon.brightness > 60
            ? 'Měsíc přesvítí hvězdy. Na Mléčnou dráhu si počkej na nov.'
            : darkNow.altitude > 3
              ? `Jádro Mléčné dráhy bude ${Math.round(darkNow.altitude)}° nad obzorem, směr ${compassPoint(darkNow.azimuth)} (${Math.round(darkNow.azimuth)}°).`
              : 'Jádro Mléčné dráhy je v tu dobu pod obzorem.'
        }
      >
        <div className="list">
          <Cell
            icon="moon"
            title={capital(moon.label)}
            sub={`${moon.rise ? `vychází ${clock(moon.rise)}` : 'ten den nevychází'}${moon.set ? ` · zapadá ${clock(moon.set)}` : ''}`}
            value={`${moon.brightness} %`}
          />
          <Cell
            icon="sparkles"
            title="Astronomická tma"
            value={light.night ? `${clock(light.night.from)}–${clock(light.night.to)}` : 'nenastane'}
          />
        </div>
      </Section>

      <Section title="Počítej s tím">
        <div className="list">
          <Cell
            icon={isRise ? 'sunrise' : 'sunset'}
            tone="sun"
            title={`Slunce ${isRise ? 'vychází' : 'zapadá'} na ${compassPoint(azimuth)}`}
            sub={isRise ? 'Nahoru jdeš za tmy: čelovka, rukavice, termoska.' : 'Dolů půjdeš za tmy: čelovka a rezerva.'}
            value={`${azimuth}°`}
          />
          {zakal && (
            <Cell
              icon="eye"
              title={capital(zakal.label)}
              sub="Odhad z aerosolu v celém sloupci vzduchu."
              value={`${zakal.rangeKm} km`}
            />
          )}
        </div>
      </Section>
    </Screen>
  )
}

function LightCell({ icon, label, window }: { icon: 'sun' | 'sunrise' | 'sunset'; label: string; window: LightWindow | null }) {
  const minutes = window ? Math.round((window.to.getTime() - window.from.getTime()) / 60000) : 0
  return (
    <Cell
      icon={icon}
      tone={label.startsWith('Zlat') ? 'sun' : undefined}
      title={label}
      sub={window ? `${minutes} min` : 'ten den nenastane'}
      value={window ? `${clock(window.from)}–${clock(window.to)}` : '—'}
    />
  )
}

function LayerCell({ name, note, pct }: { name: string; note: string; pct: number }) {
  return (
    <div className="cell">
      <div className="cell-main">
        <div className="between">
          <span className="cell-title">
            {name} <span className="faint t-foot">{note}</span>
          </span>
          <span className="num muted">{pct}&nbsp;%</span>
        </div>
        <div className="meter mt-8" data-tone="none">
          <i style={{ width: `${pct}%`, background: 'var(--ink-3)' }} />
        </div>
      </div>
    </div>
  )
}

function SkyBadge({ icon, at, sky }: { icon: 'sunrise' | 'sunset'; at: Date; sky: SkyScore }) {
  return (
    <span className="grow row" style={{ gap: 6, justifyContent: 'flex-end' }}>
      <Icon name={icon} size={16} color="var(--ink-3)" />
      <span className="t-foot faint num">{clock(at)}</span>
      <span className="badge" data-tone={skyTone(sky.score)} style={{ minWidth: 34, justifyContent: 'center' }}>
        {sky.score}
      </span>
    </span>
  )
}

/** Den jako pás: noc, modrá hodina, zlatá hodina, den — v měřítku 24 hodin. */
function LightBar({ light }: { light: ReturnType<typeof dayLight> }) {
  const day0 = light.sunrise ? new Date(light.sunrise) : new Date()
  day0.setHours(0, 0, 0, 0)
  const pos = (d: Date) => ((d.getTime() - day0.getTime()) / 86_400_000) * 100
  const band = (w: LightWindow | null, color: string, key: string): ReactNode =>
    w ? (
      <i
        key={key}
        style={{ position: 'absolute', top: 0, bottom: 0, left: `${pos(w.from)}%`, width: `${pos(w.to) - pos(w.from)}%`, background: color }}
      />
    ) : null
  const dayWindow = light.sunrise && light.sunset ? { from: light.sunrise, to: light.sunset } : null
  return (
    <div>
      <div style={{ position: 'relative', height: 16, borderRadius: 6, overflow: 'hidden', background: '#1c2230' }}>
        {band(dayWindow, '#8fc3ee', 'den')}
        {band(light.blueMorning, '#3d5a9e', 'mr')}
        {band(light.blueEvening, '#3d5a9e', 've')}
        {band(light.goldenMorning, '#f3b44b', 'zr')}
        {band(light.goldenEvening, '#f3b44b', 'zv')}
      </div>
      <div className="between t-cap faint num mt-8">
        <span>0</span>
        <span>6</span>
        <span>12</span>
        <span>18</span>
        <span>24</span>
      </div>
    </div>
  )
}

/** Obloha s oblačností po vrstvách — přesně to, z čeho se skóre počítá. */
function SkyVisual({ layers, rise, azimuth }: { layers: SkyScore['layers']; rise: boolean; azimuth: number }) {
  const id = useId().replace(/:/g, '')
  // Oblaka v pevných místech: kolik jich je a jak jsou husté, říká pokrytí vrstvy.
  const deck = (cover: number, y: number, ry: number, fill: string, spots: number[]) => {
    if (cover < 3) return null
    const count = Math.max(1, Math.round((cover / 100) * spots.length))
    return spots.slice(0, count).map((x, i) => (
      <ellipse
        key={`${y}-${i}`}
        cx={rise ? x : 360 - x}
        cy={y + (i % 2) * 4}
        rx={26 + cover * 0.5}
        ry={ry}
        fill={fill}
        opacity={0.35 + 0.5 * Math.min(1, cover / 70)}
      />
    ))
  }
  return (
    <svg viewBox="0 0 360 132" style={{ display: 'block', width: '100%' }} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1d2750" />
          <stop offset="52%" stopColor="#b8566a" />
          <stop offset="100%" stopColor="#f5b163" />
        </linearGradient>
        <radialGradient id={`${id}g`} cx="50%" cy="92%" r="42%">
          <stop offset="0%" stopColor="#ffe2a6" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ffe2a6" stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}b`} x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="3.2" />
        </filter>
      </defs>
      <rect width="360" height="132" fill={`url(#${id}s)`} />
      <rect width="360" height="132" fill={`url(#${id}g)`} />
      <g filter={`url(#${id}b)`}>
        {deck(layers.high, 20, 4, '#ffe9cf', [40, 150, 270, 95, 210, 320])}
        {deck(layers.mid, 54, 8, '#f3b2a0', [70, 250, 170, 330, 20])}
        {deck(layers.low, 92, 11, '#5b4b58', [120, 300, 30, 220, 180])}
      </g>
      <circle cx="180" cy="116" r="16" fill="#ffe7ad" />
      <path d="M0 118 L44 104 L78 113 L122 96 L158 110 L196 100 L232 111 L270 92 L306 108 L338 100 L360 108 L360 132 L0 132 Z" fill="#181b19" />
      <text x="12" y="126" fontSize="10" fontWeight="600" fill="rgba(255,255,255,0.72)" fontFamily="-apple-system, system-ui, sans-serif">
        {compassPoint(azimuth)} · {azimuth}°
      </text>
    </svg>
  )
}
