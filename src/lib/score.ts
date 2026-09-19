import { SNOW_CM_PER_MM } from './openMeteo'
import type { HourPoint, Spread, Waypoint } from './types'

export type Verdict = 'jdi' | 'zvaz' | 'nejdi'

export interface Issue {
  key: string
  text: string
  severity: 'blok' | 'varovani'
}

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

/**
 * Nad touto výškou bereme bod jako exponovaný: v českých horách zhruba hranice lesa,
 * odkud se před bouřkou ani větrem nemáš kam schovat.
 */
export const EXPOSED_ABOVE_M = 1200

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

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
 * Kapalná část srážek. Strop nemá schválně: dřív se penalizace zastavila na 6,7 mm/h,
 * takže liják a průtrž mračen sebraly stejně bodů a patnáct milimetrů za hodinu na
 * hřebeni pořád vycházelo jako „zvaž". Odmocnina drží první milimetry drahé
 * (mokrý je mokrý) a lineární člen nechá extrém utrhnout se dolů bez hranice.
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
 * Aditivní model to nikdy nezachytí: osm stupňů, dva milimetry a nárazy 45 km/h
 * vypadají každý zvlášť nevinně, dohromady je to nejčastější důvod zásahu
 * horské služby. Mokré šaty ztratí izolaci, vítr odvádí teplo z kůže.
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
 * jeho vodní hodnota odečte. Zbytek pod desetinu milimetru je zaokrouhlovací šum
 * dvou různých kvantilů, ne déšť — a odmocnina by z něj udělala tři body.
 */
function rainOf(hour: HourPoint): number {
  const mm = hour.precipitationRisk - hour.snowfallRisk / SNOW_CM_PER_MM
  return mm < 0.1 ? 0 : mm
}

/** Oskóruje jednu hodinu v jednom bodě trasy. 100 = ideál. */
export function scoreHour(
  hour: HourPoint,
  waypoint: Waypoint,
  context: HourContext = NO_CONTEXT,
): HourScore {
  const exposed = waypoint.elevation >= EXPOSED_ABOVE_M
  const issues: Issue[] = []

  // Skóruje se z nepříznivého kvartilu ansámblu, ne z nejpravděpodobnější hodnoty.
  // Túra se plánuje na horší variantu — ta pravděpodobná se o sebe postará sama.
  const rain = rainOf(hour)
  // Když všechno, co padá, je sníh, nepatří šance na srážky k dešti — tu si už
  // vybral sníh. Jinak by zasněžená hodina platila penalizaci dvakrát.
  const rainProbability = rain === 0 && hour.snowfallRisk > 0.1 ? 0 : hour.precipitationProbability
  const gusts = hour.windGustsRisk
  const apparent = hour.apparentTemperatureRisk
  const wet = rain >= 0.4 || context.soakedMm >= 1.5

  // Penalizace se nesčítají naslepo — každá si nese, kolik sebrala a proč,
  // aby šlo výsledné číslo rozporovat místo slepé důvěry.
  const raw = {
    teplota: tempPenalty(apparent),
    vitr: gustPenalty(gusts) * (exposed ? 1.25 : 1),
    srazky: rainPenalty(rain, rainProbability),
    podchlazeni: hypothermiaPenalty(apparent, wet, gusts),
    mokro: soakPenalty(context.soakedMm),
    snih: snowPenalty(hour.snowfallRisk, hour.snowDepth),
    bourka: stormPenalty(hour.capeRisk) * (exposed ? 1.4 : 1),
    mlha: visibilityPenalty(hour.visibility),
    namraza: icingPenalty(hour, waypoint.elevation),
  }
  const penalty = Object.values(raw).reduce((a, b) => a + b, 0)

  const t = Math.round(apparent)
  const penalties: Penalty[] = [
    {
      key: 'teplota',
      label: apparent < 5 ? 'Chlad' : 'Horko',
      points: raw.teplota,
      detail: `pocitově ${t < 0 ? '−' + Math.abs(t) : t} °C`,
    },
    {
      key: 'vitr',
      label: 'Vítr',
      points: raw.vitr,
      detail: `nárazy ${Math.round(gusts)} km/h${exposed ? ', exponované místo' : ''}`,
    },
    {
      key: 'srazky',
      label: 'Srážky',
      points: raw.srazky,
      detail: `${rain.toFixed(1)} mm, prší ${Math.round(rainProbability)} % členů ansámblu`,
    },
    {
      key: 'podchlazeni',
      label: 'Podchlazení',
      points: raw.podchlazeni,
      detail: `mokro, pocitově ${t < 0 ? '−' + Math.abs(t) : t} °C a nárazy ${Math.round(gusts)} km/h`,
    },
    {
      key: 'mokro',
      label: 'Promočení',
      points: raw.mokro,
      detail: `${context.soakedMm.toFixed(1)} mm nasbíráno cestou sem`,
    },
    {
      key: 'snih',
      label: 'Sníh',
      points: raw.snih,
      detail: `padá ${hour.snowfallRisk.toFixed(1)} cm/h, leží ${Math.round(hour.snowDepth * 100)} cm`,
    },
    { key: 'bourka', label: 'Bouřka', points: raw.bourka, detail: `CAPE ${Math.round(hour.capeRisk)} J/kg` },
    {
      key: 'mlha',
      label: 'Viditelnost',
      points: raw.mlha,
      detail: hour.visibility === null ? 'model ji nehlásí' : `${Math.round(hour.visibility)} m`,
    },
    {
      key: 'namraza',
      label: 'Námraza',
      points: raw.namraza,
      detail: 'nulová izoterma pod vrcholem a prší',
    },
  ]
    .filter((x) => x.points >= 0.5)
    .sort((a, b) => b.points - a.points)

  // Tvrdé zákazy. Ty přebijí skóre bez ohledu na to, jak hezky vyšlo.
  if (gusts >= 75 && exposed) {
    issues.push({
      key: 'vitr',
      severity: 'blok',
      text: `Nárazy ${Math.round(gusts)} km/h na exponovaném místě — ${waypoint.name}. V takovém větru se neudržíš na nohou.`,
    })
  }
  if (hour.capeRisk >= 1200 && hour.precipitationRisk > 0.2) {
    issues.push({
      key: 'bourka',
      severity: 'blok',
      text: `Bouřky na trase (CAPE ${Math.round(hour.capeRisk)}) — ${waypoint.name}. Na hřebeni se nemáš kam schovat.`,
    })
  }
  if (hour.visibility !== null && hour.visibility < 300) {
    issues.push({
      key: 'mlha',
      severity: 'blok',
      text: `Viditelnost ${Math.round(hour.visibility)} m — ${waypoint.name}. Bez GPS se tam ztratíš.`,
    })
  }
  if (apparent <= -15 && gusts >= 50) {
    issues.push({
      key: 'omrzliny',
      severity: 'blok',
      text: `Pocitově ${Math.round(apparent)} °C při nárazech ${Math.round(gusts)} km/h — riziko omrzlin.`,
    })
  }
  if (wet && apparent <= 6 && gusts >= 40) {
    issues.push({
      key: 'podchlazeni',
      severity: 'blok',
      text: `Mokro, pocitově ${Math.round(apparent)} °C a nárazy ${Math.round(gusts)} km/h — ${waypoint.name}. Tohle je učebnicové podchlazení, ne nepohoda.`,
    })
  }

  // Měkká varování.
  if (!issues.some((i) => i.key === 'vitr') && gusts >= 50) {
    issues.push({
      key: 'vitr',
      severity: 'varovani',
      text: `Nárazy ${Math.round(gusts)} km/h — ${waypoint.name}. Vezmi větrovku.`,
    })
  }
  if (!issues.some((i) => i.key === 'vitr') && hour.windGustsHigh >= 85 && exposed) {
    issues.push({
      key: 'vitr-chvost',
      severity: 'varovani',
      text: `Desetina členů ansámblu dává na ${waypoint.name} nárazy až ${Math.round(hour.windGustsHigh)} km/h. Nejistota je na špatné straně.`,
    })
  }
  if (!issues.some((i) => i.key === 'bourka') && hour.capeRisk >= 500) {
    issues.push({
      key: 'bourka',
      severity: 'varovani',
      text: `Zvýšené riziko bouřek (CAPE ${Math.round(hour.capeRisk)}) — ${waypoint.name}.`,
    })
  }
  if (!issues.some((i) => i.key === 'podchlazeni') && raw.podchlazeni >= 12) {
    issues.push({
      key: 'podchlazeni',
      severity: 'varovani',
      text: `Mokro a vítr při pocitových ${Math.round(apparent)} °C — ${waypoint.name}. Nepromokavá vrstva a náhradní suché vršek, ne jen svetr.`,
    })
  }
  if (rain >= 1) {
    issues.push({
      key: 'srazky',
      severity: 'varovani',
      text: `Srážky ${rain.toFixed(1)} mm/h — ${waypoint.name}.`,
    })
  }
  if (hour.snowfallRisk >= 0.5) {
    issues.push({
      key: 'snih',
      severity: 'varovani',
      text: `Sněží ${hour.snowfallRisk.toFixed(1)} cm/h — ${waypoint.name}. Značky zmizí pod sněhem.`,
    })
  }
  if (hour.snowDepth >= 0.4) {
    issues.push({
      key: 'snih-lezi',
      severity: 'varovani',
      text: `Leží ${Math.round(hour.snowDepth * 100)} cm sněhu — ${waypoint.name}. Bez prošlapané stopy to bude boj.`,
    })
  }
  if (raw.namraza > 0) {
    issues.push({
      key: 'namraza',
      severity: 'varovani',
      text: `Nulová izoterma je pod vrcholem a prší — počítej s námrazou na kamenech.`,
    })
  }

  return { score: Math.round(clamp(100 - penalty, 0, 100)), issues, penalties }
}

/**
 * Jak moc se skóre hýbe mezi nejlepším a nepříznivým scénářem, který ansámbl drží.
 * Tohle appka ukazuje jako jistotu — ne „modely se shodly na čísle", ale
 * „verdikt se v rozptylu členů nehýbe". Když se hýbe, je to samo o sobě informace.
 */
export function certaintyOf(
  hour: HourPoint,
  spread: Spread,
  waypoint: Waypoint,
  context: HourContext = NO_CONTEXT,
): number | null {
  if (spread.members === 0) return null

  const best: HourPoint = {
    ...hour,
    apparentTemperatureRisk: hour.apparentTemperatureRisk + spread.temperature,
    precipitationRisk: Math.max(0, hour.precipitationRisk - spread.precipitation),
    windGustsRisk: Math.max(0, hour.windGustsRisk - spread.windGusts),
    windGustsHigh: Math.max(0, hour.windGustsHigh - spread.windGusts),
  }
  const wobble = scoreHour(best, waypoint, context).score - scoreHour(hour, waypoint, context).score
  return Math.round(clamp(100 - wobble * 1.4, 0, 100))
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
): RouteScore {
  if (points.length === 0) {
    return { score: 0, verdict: 'nejdi', blockers: [], warnings: [], weakest: null, rainMm: 0 }
  }

  let soakedMm = 0
  const scored = points.map((p) => {
    const result = scoreHour(p.hour, p.waypoint, { soakedMm })
    soakedMm += rainOf(p.hour)
    return { ...p, ...result }
  })

  const min = Math.min(...scored.map((s) => s.score))
  const mean = scored.reduce((s, x) => s + x.score, 0) / scored.length
  const score = Math.round(0.6 * min + 0.4 * mean)

  const all = scored.flatMap((s) => s.issues)
  const blockers = dedupe(all.filter((i) => i.severity === 'blok'))
  const warnings = dedupe(all.filter((i) => i.severity === 'varovani'))
  const weakest = scored.find((s) => s.score === min) ?? null

  return {
    score: blockers.length > 0 ? Math.min(score, 25) : score,
    verdict: blockers.length > 0 ? 'nejdi' : verdictOf(score),
    blockers,
    warnings,
    rainMm: soakedMm,
    weakest: weakest
      ? {
          waypoint: weakest.waypoint,
          hour: weakest.hour,
          score: weakest.score,
          penalties: weakest.penalties,
        }
      : null,
  }
}

export function verdictOf(score: number): Verdict {
  if (score >= 65) return 'jdi'
  if (score >= 35) return 'zvaz'
  return 'nejdi'
}

/** Stejný typ problému na pěti bodech je pořád jeden problém. */
function dedupe(issues: Issue[]): Issue[] {
  const seen = new Set<string>()
  return issues.filter((i) => (seen.has(i.key) ? false : (seen.add(i.key), true)))
}
