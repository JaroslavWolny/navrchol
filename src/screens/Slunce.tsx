import { useEffect, useState, type ReactNode } from 'react'
import { Icon } from '../components/Icon'
import { Screen } from '../components/Screen'
import { Section } from '../components/ui'
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
      subtitle={`${name} · ${metres(shownElevation)} · ${week.length} dní dopředu`}
      onRefresh={data.reload}
      refreshing={data.loading}
    >
      <div className="page" style={{ marginTop: 20 }}>
        <section className="card" style={{ borderRadius: 'var(--r-hero)', overflow: 'hidden' }} aria-label={`Nejlepší ${isRise ? 'východ' : 'západ'}`}>
          <div style={{ position: 'relative' }}>
            <SkyVisual layers={hero.sky.layers} rise={isRise} />
            <span className="sky-chip">
              <svg width="10" height="10" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3 20 21 12 16 4 21z" fill="currentColor" transform={`rotate(${azimuth} 12 12)`} />
              </svg>
              {compassPoint(azimuth)} · {azimuth}°
            </span>
          </div>
          <div className="stack" style={{ padding: '18px 18px 18px 20px', gap: 14 }}>
            <div className="between" style={{ alignItems: 'flex-end' }}>
              <div className="stack" style={{ gap: 8 }}>
                <span className="label">Nejlepší {isRise ? 'východ' : 'západ'} v týdnu</span>
                <span className="best-when" style={{ fontSize: 44 }}>
                  {capital(dayLabel(hero.sky.at))}, {clock(hero.sky.at)}
                </span>
              </div>
              <div className="stack" style={{ alignItems: 'flex-end', gap: 4 }}>
                <span className="sky-score" style={{ background: skyBg(hero.sky.score) }}>
                  {hero.sky.score}
                </span>
                <span className="label" style={{ fontSize: 10.5, color: 'var(--ink-2)' }}>
                  {hero.sky.label}
                </span>
              </div>
            </div>
            <p className="t-callout" style={{ color: '#2a302c' }}>
              {vlna(hero.sky.reason)}
            </p>
            <div className="plan-strip">
              <div>
                <span>Vyraž</span>
                <b>{clock(leaveAt)}</b>
              </div>
              <div>
                <span>Nahoře</span>
                <b style={{ color: 'var(--warn)' }}>{clock(beThereAt)}</b>
              </div>
              <div>
                <span>Výstup</span>
                <b>{summitOffsetMin > 0 ? duration(summitOffsetMin) : '—'}</b>
              </div>
              {count && <p>{count}</p>}
            </div>
          </div>
        </section>
      </div>

      {terrain?.blocked ? (
        <div className="banner" data-tone="nejdi" style={{ marginTop: 10 }}>
          <Icon name="mountain" size={20} stroke={1.9} />
          <span>
            Slunce se ten den nad okolní hřebeny nedostane. Na {isRise ? 'východ' : 'západ'} se musí jinam.
          </span>
        </div>
      ) : terrainEvent && Math.abs(terrainEvent.delayMin) >= 3 ? (
        <div className="banner" data-tone="sun" style={{ marginTop: 10 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2.5 19.5 9 8.5l3.6 6 2.4-3.6 6.5 8.6z" />
            <path d="M17 3.5v2M20.5 5l-1.4 1.4M13.5 5l1.4 1.4" />
          </svg>
          <span>
            Za terénem {isRise ? 'vyleze' : 'zapadne'} v <b>{clock(terrainEvent.at)}</b>, o {Math.abs(terrainEvent.delayMin)} min{' '}
            {terrainEvent.delayMin > 0 ? 'později' : 'dřív'} než podle tabulek.
            {terrainEvent.blocker && terrainEvent.delayMin > 0
              ? ` Drží ho hřeben ${metres(terrainEvent.blocker.elevation)} ve vzdálenosti ${num(terrainEvent.blocker.distanceKm, 1)} km.`
              : ' Z\u00a0vrcholu vidíš za obzor.'}
          </span>
        </div>
      ) : null}

      <Section title="Světlo" aside={<span className="aside">{dayLabel(hero.sky.at)}</span>}>
        <div className="card" style={{ margin: '0 var(--g)', padding: '18px 16px 6px' }}>
          <LightBar light={light} />
          <div className="stack" style={{ marginTop: 10 }}>
            <LightRow color="var(--blue-hour)" label="Modrá hodina" window={light.blueMorning} />
            <LightRow color="var(--warn)" label="Zlaté ráno" window={light.goldenMorning} />
            <LightRow color="var(--warn)" label="Zlatý večer" window={light.goldenEvening} />
            <LightRow color="var(--blue-hour)" label="Modrý večer" window={light.blueEvening} />
          </div>
        </div>
      </Section>

      <Section
        title="Oblačnost"
        aside={<span className="aside">Při {isRise ? 'východu' : 'západu'}</span>}
        footer="Vysoká oblačnost chytá barvu, ideál je kolem 45 % (ryska). Nízká cloní obzor a představení zruší bez ohledu na to, co je nad ní."
      >
        <div className="card" style={{ margin: '0 var(--g)', padding: '6px 16px' }}>
          <LayerRow name="Vysoká" note="8–12 km" pct={hero.sky.layers.high} ideal />
          <LayerRow name="Střední" note="3–6 km" pct={hero.sky.layers.mid} />
          <LayerRow name="Nízká" note="do 2 km" pct={hero.sky.layers.low} />
        </div>
      </Section>

      {fogDay && (
        <Section
          title="Moře mlhy"
          aside={<span className="aside">{dayLabel(parseDay(fogDay.date))} ráno</span>}
          footer={`${fogDay.sea.reason} Počítáno k východu slunce v ${clock(fogDay.at)}, přes den se inverze obvykle rozpustí.`}
        >
          <div className="card" style={{ margin: '0 var(--g)', overflow: 'hidden' }}>
            <FogSection topM={fogDay.sea.topM} summitM={site.elevation} name={name} />
            <div style={{ padding: '4px 16px' }}>
              <Row title="Šance" sub={`inverze ${signed(fogDay.sea.strengthK, 1)} °C`} value={`${fogDay.sea.chance} %`} />
              <Row title="Hladina mlhy" value={metres(fogDay.sea.topM)} />
              <Row
                title={name}
                sub={fogDay.sea.above ? 'Budeš nad mlhou.' : 'Budeš uvnitř mlhy.'}
                value={
                  <span className="chip" style={fogDay.sea.above ? { background: 'var(--go)' } : undefined}>
                    {fogDay.sea.above ? `${metres(site.elevation - fogDay.sea.topM)} nad` : 'uvnitř'}
                  </span>
                }
              />
            </div>
          </div>
        </Section>
      )}

      <Section title="Podle dnů">
        <div className="card" style={{ margin: '0 var(--g)', padding: '6px 16px 4px' }}>
          <div className="sun-row label" style={{ minHeight: 34, fontSize: 10, borderTop: 0 }}>
            <span />
            <span>Východ</span>
            <span>Západ</span>
          </div>
          {week.map((d) => (
            <div className="sun-row" key={d.date}>
              <span style={{ fontSize: 15, fontWeight: d.date === hero.day.date ? 700 : 500 }}>{capital(dayLabel(parseDay(d.date)))}</span>
              <SkyBadge at={d.sunrise.at} score={d.sunrise.score} />
              <SkyBadge at={d.sunset.at} score={d.sunset.score} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Noc">
        <div className="card card--dark" style={{ margin: '0 var(--g)', padding: '4px 16px' }}>
          <div className="night-row">
            <MoonGlyph fraction={moon.fraction} waxing={/dorůst|první/.test(moon.label)} />
            <span className="grow stack" style={{ gap: 2 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{capital(moon.label)}</span>
              <span className="mono" style={{ fontSize: 11.5, color: 'var(--on-ink-2)' }}>
                {moon.rise ? `vychází ${clock(moon.rise)}` : 'ten den nevychází'}
                {moon.set ? ` · zapadá ${clock(moon.set)}` : ''}
              </span>
            </span>
            <span className="mono" style={{ fontSize: 15, fontWeight: 600 }}>
              {moon.brightness} %
            </span>
          </div>
          <div className="night-row">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--go)" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              <path d="M12 4v4M12 16v4M4 12h4M16 12h4" />
              <circle cx="18.5" cy="5.5" r="0.8" fill="var(--go)" />
              <circle cx="5.5" cy="18" r="0.8" fill="var(--go)" />
            </svg>
            <span className="grow stack" style={{ gap: 2 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>Astronomická tma</span>
              <span style={{ fontSize: 12.5, color: 'var(--on-ink-2)' }}>
                {vlna(
                  moon.brightness > 60
                    ? 'Měsíc přesvítí hvězdy. Na Mléčnou dráhu si počkej na nov.'
                    : darkNow.altitude > 3
                      ? `Jádro Mléčné dráhy bude ${Math.round(darkNow.altitude)}° nad obzorem, směr ${compassPoint(darkNow.azimuth)} (${Math.round(darkNow.azimuth)}°).`
                      : 'Jádro Mléčné dráhy je v tu dobu pod obzorem.',
                )}
              </span>
            </span>
            <span className="mono" style={{ fontSize: 15, fontWeight: 600 }}>
              {light.night ? `${clock(light.night.from)}–${clock(light.night.to)}` : 'nenastane'}
            </span>
          </div>
        </div>
      </Section>

      <Section title="Počítej s tím">
        <div className="tiles">
          <div className="card tile" style={zakal ? undefined : { gridColumn: '1 / -1' }}>
            <span className="tile-label">
              {isRise ? 'Východ' : 'Západ'} na {compassPoint(azimuth)}
            </span>
            <span className="tile-value" style={{ fontSize: 44 }}>
              {azimuth}°
            </span>
            <span className="tile-text">
              {vlna(isRise ? 'Nahoru jdeš za tmy: čelovka, rukavice, termoska.' : 'Dolů půjdeš za tmy: čelovka a rezerva.')}
            </span>
          </div>
          {zakal && (
            <div className="card tile">
              <span className="tile-label">Dohlednost</span>
              <span className="tile-value" style={{ fontSize: 44 }}>
                {zakal.rangeKm}
                <small>km</small>
              </span>
              <span className="tile-text">{vlna(`${capital(zakal.label)}. Odhad z aerosolu v celém sloupci vzduchu.`)}</span>
            </div>
          )}
        </div>
      </Section>
    </Screen>
  )
}

/** Podklad odznaku barevnosti: od 50 žlutá, 25–49 světle žlutá, jinak šedá. */
const skyBg = (score: number) => (score >= 50 ? 'var(--warn)' : score >= 25 ? 'var(--warn-soft)' : 'var(--sunk)')

function Row({ title, sub, value }: { title: ReactNode; sub?: string; value: ReactNode }) {
  return (
    <div className="kv-row">
      <span className="grow stack" style={{ gap: 2 }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>{title}</span>
        {sub && <span className="cell-sub">{sub}</span>}
      </span>
      <span className="mono" style={{ fontSize: 15, fontWeight: 600 }}>
        {value}
      </span>
    </div>
  )
}

function LightRow({ color, label, window }: { color: string; label: string; window: LightWindow | null }) {
  const minutes = window ? Math.round((window.to.getTime() - window.from.getTime()) / 60000) : 0
  return (
    <div className="kv-row" style={{ minHeight: 52, borderTop: '1px solid var(--line)', borderBottom: 0 }}>
      <i style={{ width: 12, height: 12, borderRadius: 4, background: color, flexShrink: 0 }} />
      <span className="grow" style={{ fontSize: 15, fontWeight: 600 }}>
        {label} <span style={{ fontWeight: 400, color: 'var(--ink-3)' }}>· {window ? `${minutes} min` : 'ten den nenastane'}</span>
      </span>
      <span className="mono" style={{ fontSize: 14, fontWeight: 600 }}>
        {window ? `${clock(window.from)}–${clock(window.to)}` : '—'}
      </span>
    </div>
  )
}

function LayerRow({ name, note, pct, ideal = false }: { name: string; note: string; pct: number; ideal?: boolean }) {
  return (
    <div className="layer-row">
      <div className="between" style={{ alignItems: 'baseline' }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>
          {name}{' '}
          <span className="mono faint" style={{ fontSize: 11, fontWeight: 400 }}>
            {note}
          </span>
        </span>
        <span className="mono" style={{ fontSize: 14, fontWeight: 600 }}>
          {pct} %
        </span>
      </div>
      <div className="layer-track">
        <i style={{ width: `${pct}%` }} />
        {ideal && <b style={{ left: '45%' }} />}
      </div>
    </div>
  )
}

function SkyBadge({ at, score }: { at: Date; score: number }) {
  return (
    <span className="row" style={{ gap: 8 }}>
      <span className="mono" style={{ fontSize: 13, color: 'var(--ink-2)', width: 40 }}>
        {clock(at)}
      </span>
      <span className="badge" style={{ background: skyBg(score), fontSize: 14, fontStretch: '78%' }}>
        {score}
      </span>
    </span>
  )
}

/** Fáze Měsíce: osvětlená část z podílu a strany, na severní polokouli dorůstá zprava. */
function MoonGlyph({ fraction, waxing }: { fraction: number; waxing: boolean }) {
  const rx = Math.abs(1 - 2 * fraction) * 8.5
  const gibbous = fraction > 0.5
  const d = waxing
    ? `M12 3.5A8.5 8.5 0 0 1 12 20.5A${rx.toFixed(2)} 8.5 0 0 ${gibbous ? 1 : 0} 12 3.5Z`
    : `M12 3.5A8.5 8.5 0 0 0 12 20.5A${rx.toFixed(2)} 8.5 0 0 ${gibbous ? 0 : 1} 12 3.5Z`
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true" style={{ flex: 'none' }}>
      <circle cx="12" cy="12" r="8.5" fill="#2a312d" />
      {fraction > 0.02 && <path d={d} fill="var(--on-ink)" />}
    </svg>
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
      <div style={{ position: 'relative', height: 22, borderRadius: 8, overflow: 'hidden', background: 'var(--night)' }}>
        {band(dayWindow, 'var(--day)', 'den')}
        {band(light.blueMorning, 'var(--blue-hour)', 'mr')}
        {band(light.blueEvening, 'var(--blue-hour)', 've')}
        {band(light.goldenMorning, 'var(--warn)', 'zr')}
        {band(light.goldenEvening, 'var(--warn)', 'zv')}
      </div>
      <div className="between mono faint" style={{ marginTop: 6, fontSize: 10 }}>
        <span>0</span>
        <span>6</span>
        <span>12</span>
        <span>18</span>
        <span>24</span>
      </div>
    </div>
  )
}

/** Řez: hladina mlhy čárkovaně proti výšce vrcholu. */
function FogSection({ topM, summitM, name }: { topM: number; summitM: number; name: string }) {
  // Svislé měřítko řezu: vrchol a hladina mlhy se vejdou s rezervou nad i pod.
  const hi = Math.max(topM, summitM) + 250
  const lo = Math.min(topM, summitM) - 650
  const y = (m: number) => 104 - ((m - lo) / (hi - lo)) * 104
  const fogY = y(topM)
  const peakY = y(summitM)
  return (
    <svg width="100%" height="104" viewBox="0 0 358 104" preserveAspectRatio="none" role="img" aria-label={`Hladina mlhy ${metres(topM)}, vrchol ${metres(summitM)}`} style={{ display: 'block' }}>
      <rect width="358" height="104" fill="#dce5f2" />
      <path
        d={`M0 104 L0 ${peakY + 46} L40 ${peakY + 40} L84 ${peakY + 26} L120 ${peakY + 18} L150 ${peakY + 4} L168 ${peakY} L186 ${peakY + 6} L214 ${peakY + 20} L250 ${peakY + 30} L292 ${peakY + 36} L330 ${peakY + 42} L358 ${peakY + 44} L358 104 Z`}
        fill="#9aa6b4"
      />
      <rect x="0" y={fogY} width="358" height={104 - fogY} fill="rgba(247,248,245,0.62)" />
      <line x1="0" y1={fogY} x2="358" y2={fogY} stroke="var(--ink)" strokeWidth="1.25" strokeDasharray="4 4" />
      <text x="14" y={Math.max(12, fogY - 6)} fontFamily="var(--mono)" fontSize="10" fill="var(--ink)">
        HLADINA MLHY {metres(topM).toUpperCase()}
      </text>
      <path d={`M168 ${peakY - 7}l8 13h-16z`} fill="var(--ink)" />
      <text x="184" y={peakY + 4} fontFamily="var(--mono)" fontSize="10" fill="var(--ink)">
        {name.toUpperCase()} {Math.round(summitM)}
      </text>
    </svg>
  )
}

/** Pásy oblohy a hřebeny podle návrhu (design/redesign-2026-10/mockups/Slunce.dc.html). */
const BANDS: Array<[number, number, string]> = [
  [0, 22, '#262a4f'],
  [22, 16, '#3d3963'],
  [38, 14, '#5e4572'],
  [52, 12, '#8b5076'],
  [64, 11, '#bc6072'],
  [75, 10, '#e27e6b'],
  [85, 10, '#f4a267'],
  [95, 65, '#fbcb84'],
]
const RIDGES = [
  { d: 'M0 160 L0 96 L9 77 L14 71 L23 65 L27 65 L32 68 L36 75 L45 91 L54 96 L63 75 L68 66 L73 61 L77 59 L82 61 L86 66 L100 95 L104 99 L109 102 L122 70 L127 63 L131 58 L136 58 L140 61 L145 67 L150 76 L163 100 L168 96 L172 90 L181 72 L186 66 L190 63 L195 64 L199 67 L204 74 L213 83 L218 90 L222 88 L227 84 L231 80 L236 73 L240 69 L245 68 L249 71 L258 80 L263 80 L267 83 L272 87 L276 85 L281 80 L290 74 L295 70 L299 67 L304 68 L308 71 L313 76 L317 78 L322 82 L326 89 L331 90 L335 83 L340 79 L349 74 L358 72 L358 160 Z', fill: '#c77c7a', dy: 14 },
  { d: 'M0 160 L0 97 L5 103 L9 103 L14 103 L32 88 L41 84 L45 83 L50 83 L59 81 L73 82 L82 76 L86 74 L91 74 L95 75 L100 77 L104 80 L113 89 L122 103 L127 101 L131 99 L140 88 L150 80 L154 78 L159 76 L163 77 L168 78 L172 80 L181 81 L190 85 L199 83 L204 83 L208 84 L227 93 L231 95 L240 103 L245 103 L249 99 L258 87 L267 78 L272 76 L276 74 L281 74 L285 75 L295 80 L308 83 L313 81 L326 78 L331 78 L335 79 L344 84 L358 99 L358 160 Z', fill: '#8a5470', dy: 16 },
  { d: 'M0 160 L0 96 L5 98 L14 106 L18 105 L27 96 L36 91 L41 90 L45 90 L54 93 L59 93 L73 89 L82 84 L86 82 L91 81 L95 81 L113 88 L118 91 L127 100 L131 103 L140 101 L145 102 L154 106 L163 99 L168 98 L177 96 L190 91 L199 86 L208 77 L213 74 L218 72 L222 72 L227 73 L231 75 L236 78 L245 88 L254 95 L272 115 L281 119 L290 124 L295 124 L304 113 L317 92 L326 83 L331 80 L335 78 L344 78 L349 76 L358 75 L358 160 Z', fill: '#4e3757', dy: 22 },
  { d: 'M0 160 L0 122 L9 127 L14 128 L18 125 L27 112 L32 108 L36 104 L41 102 L45 101 L50 101 L59 105 L63 105 L77 100 L82 100 L86 102 L91 104 L95 108 L104 120 L113 136 L118 141 L122 136 L136 115 L145 104 L150 100 L154 97 L159 95 L163 95 L168 97 L190 109 L199 111 L204 113 L208 116 L218 125 L240 116 L249 115 L258 108 L263 105 L272 101 L276 100 L281 101 L295 106 L299 109 L304 114 L317 130 L322 126 L331 115 L335 111 L349 101 L353 99 L358 98 L358 160 Z', fill: '#1d1726', dy: 14 },
]

/**
 * Obloha jako plakát: vodorovné barevné pásy místo přechodu, vrstvené hřebeny
 * a oblačnost po vrstvách — přesně to, z čeho se skóre počítá.
 */
function SkyVisual({ layers, rise }: { layers: SkyScore['layers']; rise: boolean }) {
  // Oblaka v pevných místech: kolik jich je, říká pokrytí vrstvy.
  const deck = (cover: number, y: number, h: number, fill: string, spots: number[]) => {
    if (cover < 3) return null
    const count = Math.max(1, Math.round((cover / 100) * spots.length))
    const w = 40 + cover * 0.6
    return spots.slice(0, count).map((x, i) => (
      <rect
        key={`${y}-${i}`}
        x={(rise ? x : 358 - x) - w / 2}
        y={y + (i % 2) * 4}
        width={w}
        height={h}
        rx={h / 2}
        fill={fill}
        opacity={0.45 + 0.45 * Math.min(1, cover / 70)}
      />
    ))
  }
  return (
    <svg width="100%" height="176" viewBox="0 0 358 160" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style={{ display: 'block' }}>
      {BANDS.map(([y, h, c]) => (
        <rect key={y} x="0" y={y} width="358" height={h} fill={c} />
      ))}
      <circle cx="196" cy="88" r="15" fill="#fff0c7" />
      {deck(layers.high, 14, 5, '#ffe9cf', [40, 150, 270, 95, 210, 320])}
      {deck(layers.mid, 44, 9, '#f3b2a0', [70, 250, 170, 330, 20])}
      {deck(layers.low, 70, 12, '#5b4b58', [120, 300, 30, 220, 180])}
      {RIDGES.map((r) => (
        <path key={r.fill} d={r.d} fill={r.fill} transform={`translate(0 ${r.dy})`} />
      ))}
    </svg>
  )
}
