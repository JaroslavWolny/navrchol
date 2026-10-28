import { EXPOSED_ABOVE_M, SNOW_CM_PER_MM } from './constants'
import type { HourPoint, Spread, Waypoint } from './types'

export { EXPOSED_ABOVE_M } from './constants'

export type Verdict = 'jdi' | 'zvaz' | 'nejdi'

export interface Issue {
  key: string
  severity: 'blok' | 'varovani'
  /** Krátké tvrzení: „Nárazy až 82 km/h". */
  title: string
  /** Co z toho plyne. */
  detail: string
  /** Kde na trase. */
  place: string
  /** Hodina, kdy to nastane (čas z předpovědi). */
  at?: string
  /** Síla jevu — při sloučení stejných problémů zůstane ten nejhorší. */
  magnitude: number
  /** Tvrdý zákaz, který si člověk vypnul. Verdikt nepřebije, ale nesmí se ztratit mezi drobnostmi. */
  bypassed?: boolean
}

/** Jak moc komu vadí jev, který bere body jen za pohodlí. */
export type Tolerance = 'vadi' | 'bezne' | 'nevadi'

/** Jevy, které si každý nastaví podle sebe. Bouřka, podchlazení a námraza mezi ně nepatří. */
export type ComfortKey = 'dest' | 'vitr' | 'chlad' | 'horko' | 'snih' | 'vyhled'

/** Tvrdé zákazy. Klíče jsou stejné jako u problémů, které je hlásí. */
export type BanKey = 'vitr' | 'bourka' | 'mlha' | 'omrzliny' | 'podchlazeni'

/** Co komu vadí. Každý má „jdi" a „nejdi" jinde. */
export interface Preferences {
  comfort: Record<ComfortKey, Tolerance>
  /** Zákazy, které si člověk vypnul. Pak jen varují. */
  bansOff: BanKey[]
}

export const DEFAULT_PREFS: Preferences = {
  comfort: { dest: 'bezne', vitr: 'bezne', chlad: 'bezne', horko: 'bezne', snih: 'bezne', vyhled: 'bezne' },
  bansOff: [],
}

/**
 * Násobek bodů za pohodlí. „Nevadí" nebere body úplně: dva milimetry deště
 * přehlédne, ale hodina průtrže mračen (15 mm/h) pořád stáhne verdikt na zvaž.
 */
const TOLERANCE_FACTOR: Record<Tolerance, number> = { vadi: 1.5, bezne: 1, nevadi: 0.35 }
const TOLERANCE_NOTE: Record<Tolerance, string> = { vadi: ' · tobě vadí víc', bezne: '', nevadi: ' · tobě moc nevadí' }

/** Jedna položka rozpadu skóre — kolik bodů který jev sebral a proč. */
export interface Penalty {
  key: string
  label: string
  points: number
  detail: string
}

export interface HourScore {
  score: number
  issues: Issue[]
  penalties: Penalty[]
}

/**
 * Co se stalo do téhle hodiny. Promočení se nevrací zpátky: jednou mokrý člověk
 * je mokrý celou zbývající túru, a od toho se odvíjí riziko podchlazení.
 */
export interface HourContext {
  /** Kolik milimetrů deště už na tebe od startu spadlo. */
  soakedMm: number
}

const NO_CONTEXT: HourContext = { soakedMm: 0 }

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const deg = (t: number) => {
  const r = Math.round(t)
  return `${r < 0 ? '−' + Math.abs(r) : r} °C`
}
const dec = (v: number) => v.toFixed(1).replace('.', ',')

/** Chlad a horko od pocitové teploty. Pohodlné pásmo pro chůzi je 5 až 18 °C. */
function tempPenalty(apparent: number): number {
  if (apparent < 5) return clamp((5 - apparent) * 2.2, 0, 45)
  if (apparent > 24) return clamp((apparent - 24) * 2, 0, 30)
  return 0
}

/** Nárazy bolí mnohem víc než průměrný vítr — proto se počítá jen z nárazů. */
function gustPenalty(gusts: number): number {
  if (gusts < 30) return 0
  if (gusts < 50) return (gusts - 30) * 0.8
  if (gusts < 70) return 16 + (gusts - 50) * 1.4
  return clamp(44 + (gusts - 70) * 2, 0, 60)
}

/**
 * Kapalná část srážek. Strop nemá schválně: liják a průtrž mračen nesmí sebrat
 * stejně bodů. Odmocnina drží první milimetry drahé (mokrý je mokrý) a lineární
 * člen nechá extrém utrhnout se dolů bez hranice.
 */
function rainPenalty(mm: number, probability: number): number {
  const wet = mm <= 0 ? 0 : 14 * Math.sqrt(mm) + 3 * mm
  // Pravděpodobnost je podíl členů ansámblu, kterým prší. I bez vody v kvantilu
  // znamená vysoká šance, že pláštěnku poneseš a nejspíš i použiješ.
  return wet + clamp(probability * 0.12, 0, 12)
}

/** Sníh nepromočí jako déšť, ale zavře značky a prošlapávání sebere hodiny. */
function snowPenalty(fallingCm: number, depthM: number): number {
  const falling = clamp(fallingCm * 9, 0, 35)
  // Do dvaceti centimetrů se dá jít, po kolena už je to jiná disciplína.
  const lying = clamp((depthM - 0.2) * 40, 0, 20)
  return falling + lying
}

/** CAPE je zásoba energie pro bouřku. Pod 300 se prakticky nic neděje. */
function stormPenalty(cape: number): number {
  if (cape < 300) return 0
  if (cape < 800) return (cape - 300) * 0.03
  return clamp(15 + (cape - 800) * 0.02, 0, 45)
}

function visibilityPenalty(visibility: number | null): number {
  if (visibility === null) return 0
  if (visibility > 5000) return 0
  if (visibility > 1000) return ((5000 - visibility) / 100) * 0.6
  return 30
}

/** Déšť při teplotě pod nulou v dané výšce znamená námrazu na kamenech. */
function icingPenalty(hour: HourPoint, elevation: number): number {
  const freezing = hour.freezingLevel
  if (freezing === null) return 0
  const belowFreezing = freezing < elevation
  return belowFreezing && hour.precipitationRisk > 0.2 ? 20 : 0
}

/**
 * Podchlazení nedělá chlad, ani déšť, ani vítr samotný — dělá ho jejich součin.
 * Osm stupňů, dva milimetry a nárazy 45 km/h vypadají každý zvlášť nevinně,
 * dohromady je to nejčastější důvod zásahu horské služby.
 */
function hypothermiaPenalty(apparent: number, wet: boolean, gusts: number): number {
  if (!wet || apparent > 12) return 0
  const cold = clamp((12 - apparent) / 12, 0, 1)
  const wind = clamp((gusts - 15) / 45, 0, 1)
  return 55 * cold * (0.35 + 0.65 * wind)
}

/** Nasáklé vrstvy netopí ani potom, co přestane pršet. */
function soakPenalty(soakedMm: number): number {
  return clamp((soakedMm - 0.5) * 2.2, 0, 24)
}

/**
 * Kapalná část srážek v nepříznivém kvartilu. Sníh má vlastní penalizaci, takže se
 * jeho vodní hodnota odečte. Zbytek pod desetinu milimetru je šum, ne déšť.
 */
export function rainOf(hour: HourPoint): number {
  const mm = hour.precipitationRisk - hour.snowfallRisk / SNOW_CM_PER_MM
  return mm < 0.1 ? 0 : mm
}

/** Oskóruje jednu hodinu v jednom místě trasy. 100 = ideál. */
export function scoreHour(
  hour: HourPoint,
  waypoint: Waypoint,
  context: HourContext = NO_CONTEXT,
  prefs: Preferences = DEFAULT_PREFS,
): HourScore {
  const exposed = waypoint.elevation >= EXPOSED_ABOVE_M
  const issues: Issue[] = []
  const place = waypoint.name
  const factor = (k: ComfortKey) => TOLERANCE_FACTOR[prefs.comfort[k]]
  const note = (k: ComfortKey) => TOLERANCE_NOTE[prefs.comfort[k]]

  // Skóruje se z nepříznivého kvartilu ansámblu, ne z nejpravděpodobnější hodnoty.
  const rain = rainOf(hour)
  // Když všechno, co padá, je sníh, nepatří šance na srážky k dešti.
  const rainProbability = rain === 0 && hour.snowfallRisk > 0.1 ? 0 : hour.precipitationProbability
  const gusts = hour.windGustsRisk
  const apparent = hour.apparentTemperatureRisk
  const wet = rain >= 0.4 || context.soakedMm >= 1.5
  const temp: ComfortKey = apparent < 5 ? 'chlad' : 'horko'

  // Bouřka, podchlazení a námraza nejsou otázka pohodlí, ty se podle nastavení neškálují.
  const raw = {
    teplota: tempPenalty(apparent) * factor(temp),
    vitr: gustPenalty(gusts) * (exposed ? 1.25 : 1) * factor('vitr'),
    srazky: rainPenalty(rain, rainProbability) * factor('dest'),
    podchlazeni: hypothermiaPenalty(apparent, wet, gusts),
    mokro: soakPenalty(context.soakedMm) * factor('dest'),
    snih: snowPenalty(hour.snowfallRisk, hour.snowDepth) * factor('snih'),
    bourka: stormPenalty(hour.capeRisk) * (exposed ? 1.4 : 1),
    mlha: visibilityPenalty(hour.visibility) * factor('vyhled'),
    namraza: icingPenalty(hour, waypoint.elevation),
  }
  const penalty = Object.values(raw).reduce((a, b) => a + b, 0)
  const g = Math.round(gusts)

  const penalties: Penalty[] = [
    {
      key: 'teplota',
      label: apparent < 5 ? 'Chlad' : 'Horko',
      points: raw.teplota,
      detail: `pocitově ${deg(apparent)}${note(temp)}`,
    },
    {
      key: 'vitr',
      label: 'Vítr',
      points: raw.vitr,
      detail: `nárazy ${g} km/h${exposed ? ' na hřebeni' : ''}${hour.ridgeWind ? ', dopočteno z volné atmosféry' : ''}${note('vitr')}`,
    },
    {
      key: 'srazky',
      label: 'Srážky',
      points: raw.srazky,
      detail: `${dec(rain)} mm/h, prší v ${Math.round(rainProbability)} % scénářů${note('dest')}`,
    },
    {
      key: 'podchlazeni',
      label: 'Podchlazení',
      points: raw.podchlazeni,
      detail: `mokro, pocitově ${deg(apparent)}, nárazy ${g} km/h`,
    },
    {
      key: 'mokro',
      label: 'Promočení',
      points: raw.mokro,
      detail: `${dec(context.soakedMm)} mm nasbíráno cestou${note('dest')}`,
    },
    {
      key: 'snih',
      label: 'Sníh',
      points: raw.snih,
      detail: `padá ${dec(hour.snowfallRisk)} cm/h, leží ${Math.round(hour.snowDepth * 100)} cm${note('snih')}`,
    },
    { key: 'bourka', label: 'Bouřka', points: raw.bourka, detail: `CAPE ${Math.round(hour.capeRisk)} J/kg` },
    {
      key: 'mlha',
      label: 'Viditelnost',
      points: raw.mlha,
      detail: `${hour.visibility === null ? 'model ji nehlásí' : `${Math.round(hour.visibility)} m`}${note('vyhled')}`,
    },
    { key: 'namraza', label: 'Námraza', points: raw.namraza, detail: 'nulová izoterma pod trasou a prší' },
  ]
    .filter((x) => x.points >= 0.5)
    .sort((a, b) => b.points - a.points)

  const add = (i: Omit<Issue, 'place' | 'at'>) => issues.push({ ...i, place, at: hour.time })
  // Vypnutý zákaz verdikt nepřebije, ale ohlásí se dál — jako varování.
  const ban = (key: BanKey, i: Pick<Issue, 'title' | 'detail' | 'magnitude'>) =>
    add(
      prefs.bansOff.includes(key)
        ? { ...i, key, severity: 'varovani', detail: `${i.detail} Zákaz máš vypnutý.`, bypassed: true }
        : { ...i, key, severity: 'blok' },
    )

  // Tvrdé zákazy. Ty přebijí skóre bez ohledu na to, jak hezky vyšlo — pokud si je člověk nevypnul.
  if (gusts >= 75 && exposed) {
    ban('vitr', {
      title: `Nárazy až ${g} km/h`,
      detail: 'V takovém větru se na odkrytém hřebeni neudržíš na nohou.',
      magnitude: gusts,
    })
  }
  if (hour.capeRisk >= 1200 && hour.precipitationRisk > 0.2) {
    ban('bourka', {
      title: 'Bouřky na trase',
      detail: `CAPE ${Math.round(hour.capeRisk)} J/kg a srážky. Nad lesem se nemáš kam schovat.`,
      magnitude: hour.capeRisk,
    })
  }
  if (hour.visibility !== null && hour.visibility < 300) {
    ban('mlha', {
      title: `Viditelnost ${Math.round(hour.visibility)} m`,
      detail: 'Hustá mlha. Bez navigace se snadno ztratíš.',
      magnitude: 1000 - hour.visibility,
    })
  }
  if (apparent <= -15 && gusts >= 50) {
    ban('omrzliny', {
      title: `Pocitově ${deg(apparent)}`,
      detail: `Při nárazech ${g} km/h hrozí omrzliny na odkrytých místech.`,
      magnitude: -apparent,
    })
  }
  if (wet && apparent <= 6 && gusts >= 40) {
    ban('podchlazeni', {
      title: 'Riziko podchlazení',
      detail: `Mokro, pocitově ${deg(apparent)} a nárazy ${g} km/h.`,
      magnitude: raw.podchlazeni,
    })
  }

  // Měkká varování.
  if (!issues.some((i) => i.key === 'vitr') && gusts >= 50) {
    add({
      key: 'vitr',
      severity: 'varovani',
      title: `Nárazy ${g} km/h`,
      detail: exposed ? 'Na hřebeni počítej s poryvy, vezmi větrovku.' : 'Vezmi větrovku.',
      magnitude: gusts,
    })
  }
  if (!issues.some((i) => i.key === 'vitr') && hour.windGustsHigh >= 85 && exposed) {
    add({
      key: 'vitr-chvost',
      severity: 'varovani',
      title: `Nárazy možná až ${Math.round(hour.windGustsHigh)} km/h`,
      detail: 'Desetina scénářů ansámblu je výrazně větrnější než zbytek.',
      magnitude: hour.windGustsHigh,
    })
  }
  if (!issues.some((i) => i.key === 'bourka') && hour.capeRisk >= 500) {
    add({
      key: 'bourka',
      severity: 'varovani',
      title: 'Možné bouřky',
      detail: `CAPE ${Math.round(hour.capeRisk)} J/kg. Sleduj oblohu a měj plán, kudy sejít.`,
      magnitude: hour.capeRisk,
    })
  }
  if (!issues.some((i) => i.key === 'podchlazeni') && raw.podchlazeni >= 12) {
    add({
      key: 'podchlazeni',
      severity: 'varovani',
      title: 'Mokro a vítr v chladu',
      detail: `Pocitově ${deg(apparent)}. Nepromokavá vrstva a suché oblečení do batohu.`,
      magnitude: raw.podchlazeni,
    })
  }
  if (rain >= 1) {
    add({
      key: 'srazky',
      severity: 'varovani',
      title: `Déšť ${dec(rain)} mm/h`,
      detail: 'Počítej s mokrou cestou.',
      magnitude: rain,
    })
  }
  if (hour.snowfallRisk >= 0.5) {
    add({
      key: 'snih',
      severity: 'varovani',
      title: `Sněží ${dec(hour.snowfallRisk)} cm/h`,
      detail: 'Značení může zapadat.',
      magnitude: hour.snowfallRisk,
    })
  }
  if (hour.snowDepth >= 0.4) {
    add({
      key: 'snih-lezi',
      severity: 'varovani',
      title: `Leží ${Math.round(hour.snowDepth * 100)} cm sněhu`,
      detail: 'Bez prošlapané stopy půjdeš výrazně pomaleji.',
      magnitude: hour.snowDepth,
    })
  }
  if (raw.namraza > 0) {
    add({
      key: 'namraza',
      severity: 'varovani',
      title: 'Námraza',
      detail: 'Nulová izoterma je pod trasou a prší. Kameny budou kluzké.',
      magnitude: hour.precipitationRisk,
    })
  }

  return { score: Math.round(clamp(100 - penalty, 0, 100)), issues, penalties }
}

/**
 * Jak moc se skóre hýbe mezi nejlepším a nepříznivým scénářem, který ansámbl drží.
 * Tohle appka ukazuje jako jistotu: „verdikt se v rozptylu členů nehýbe".
 */
export function certaintyOf(
  hour: HourPoint,
  spread: Spread,
  waypoint: Waypoint,
  context: HourContext = NO_CONTEXT,
  prefs: Preferences = DEFAULT_PREFS,
): number | null {
  if (spread.members === 0) return null

  const best: HourPoint = {
    ...hour,
    apparentTemperatureRisk: hour.apparentTemperatureRisk + spread.temperature,
    precipitationRisk: Math.max(0, hour.precipitationRisk - spread.precipitation),
    windGustsRisk: Math.max(0, hour.windGustsRisk - spread.windGusts),
    windGustsHigh: Math.max(0, hour.windGustsHigh - spread.windGusts),
  }
  const wobble = scoreHour(best, waypoint, context, prefs).score - scoreHour(hour, waypoint, context, prefs).score
  return Math.round(clamp(100 - wobble * 1.4, 0, 100))
}

export interface ScoredHour {
  score: number
  penalties: Penalty[]
}

export interface RouteScore {
  score: number
  verdict: Verdict
  blockers: Issue[]
  warnings: Issue[]
  /** Nejhorší místo trasy — to, které skóre stáhlo dolů. */
  weakest: { waypoint: Waypoint; hour: HourPoint; score: number; penalties: Penalty[] } | null
  /** Kolik deště na tebe za celou túru spadne, v milimetrech. */
  rainMm: number
  /** Skóre každého vzorku v pořadí, v jakém přišly. */
  hourly: ScoredHour[]
}

/**
 * Skóre celé trasy. Bere 60 % z nejhoršího místa a 40 % z průměru:
 * túra je tak dobrá, jak dobrý je její nejhorší úsek, ale jedna špatná hodina
 * z osmi hezkých ještě neznamená katastrofu.
 *
 * Body musí jít v čase po sobě — promočení se mezi nimi kumuluje.
 */
export function scoreRoute(
  points: Array<{ waypoint: Waypoint; hour: HourPoint }>,
  prefs: Preferences = DEFAULT_PREFS,
): RouteScore {
  if (points.length === 0) {
    return { score: 0, verdict: 'nejdi', blockers: [], warnings: [], weakest: null, rainMm: 0, hourly: [] }
  }

  let soakedMm = 0
  const scored = points.map((p) => {
    const result = scoreHour(p.hour, p.waypoint, { soakedMm }, prefs)
    soakedMm += rainOf(p.hour)
    return { ...p, ...result }
  })

  const min = Math.min(...scored.map((s) => s.score))
  const mean = scored.reduce((s, x) => s + x.score, 0) / scored.length
  const score = Math.round(0.6 * min + 0.4 * mean)

  const all = scored.flatMap((s) => s.issues)
  const blockers = dedupe(all.filter((i) => i.severity === 'blok'))
  const warnings = dedupe(all.filter((i) => i.severity === 'varovani'))
    .filter((w) => !blockers.some((b) => b.key === w.key))
    // Vypnuté zákazy jdou první, ať je nepřekryje varování před deštěm.
    .sort((a, b) => Number(b.bypassed ?? false) - Number(a.bypassed ?? false))
  const weakest = scored.find((s) => s.score === min) ?? null

  return {
    score: blockers.length > 0 ? Math.min(score, 25) : score,
    verdict: blockers.length > 0 ? 'nejdi' : verdictOf(score),
    blockers,
    warnings,
    rainMm: soakedMm,
    hourly: scored.map((s) => ({ score: s.score, penalties: s.penalties })),
    weakest: weakest
      ? { waypoint: weakest.waypoint, hour: weakest.hour, score: weakest.score, penalties: weakest.penalties }
      : null,
  }
}

export function verdictOf(score: number): Verdict {
  if (score >= 65) return 'jdi'
  if (score >= 35) return 'zvaz'
  return 'nejdi'
}

/** Stejný typ problému na pěti místech je pořád jeden problém — ukáže se ten nejhorší. */
function dedupe(issues: Issue[]): Issue[] {
  const best = new Map<string, Issue>()
  for (const i of issues) {
    const seen = best.get(i.key)
    if (!seen || i.magnitude > seen.magnitude) best.set(i.key, i)
  }
  return [...best.values()].sort((a, b) => (a.at ?? '').localeCompare(b.at ?? ''))
}
