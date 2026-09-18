import type { HourPoint, Waypoint } from './types'

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

function rainPenalty(mm: number, probability: number): number {
  return clamp(mm * 6, 0, 40) + clamp(probability * 0.15, 0, 15)
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
  return belowFreezing && hour.precipitation > 0.2 ? 20 : 0
}

/** Oskóruje jednu hodinu v jednom bodě trasy. 100 = ideál. */
export function scoreHour(hour: HourPoint, waypoint: Waypoint): HourScore {
  const exposed = waypoint.elevation >= EXPOSED_ABOVE_M
  const issues: Issue[] = []

  // Penalizace se nesčítají naslepo — každá si nese, kolik sebrala a proč,
  // aby šlo výsledné číslo rozporovat místo slepé důvěry.
  const raw = {
    teplota: tempPenalty(hour.apparentTemperature),
    vitr: gustPenalty(hour.windGusts) * (exposed ? 1.25 : 1),
    srazky: rainPenalty(hour.precipitation, hour.precipitationProbability),
    bourka: stormPenalty(hour.cape) * (exposed ? 1.4 : 1),
    mlha: visibilityPenalty(hour.visibility),
    namraza: icingPenalty(hour, waypoint.elevation),
  }
  const penalty = Object.values(raw).reduce((a, b) => a + b, 0)

  const t = Math.round(hour.apparentTemperature)
  const penalties: Penalty[] = [
    {
      key: 'teplota',
      label: hour.apparentTemperature < 5 ? 'Chlad' : 'Horko',
      points: raw.teplota,
      detail: `pocitově ${t < 0 ? '\u2212' + Math.abs(t) : t} °C`,
    },
    {
      key: 'vitr',
      label: 'Vítr',
      points: raw.vitr,
      detail: `nárazy ${Math.round(hour.windGusts)} km/h${exposed ? ', exponované místo' : ''}`,
    },
    {
      key: 'srazky',
      label: 'Srážky',
      points: raw.srazky,
      detail: `${hour.precipitation.toFixed(1)} mm, pravděpodobnost ${Math.round(hour.precipitationProbability)} %`,
    },
    { key: 'bourka', label: 'Bouřka', points: raw.bourka, detail: `CAPE ${Math.round(hour.cape)} J/kg` },
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
  if (hour.windGusts >= 75 && exposed) {
    issues.push({
      key: 'vitr',
      severity: 'blok',
      text: `Nárazy ${Math.round(hour.windGusts)} km/h na exponovaném místě — ${waypoint.name}. V takovém větru se neudržíš na nohou.`,
    })
  }
  if (hour.cape >= 1200 && hour.precipitation > 0.2) {
    issues.push({
      key: 'bourka',
      severity: 'blok',
      text: `Bouřky na trase (CAPE ${Math.round(hour.cape)}) — ${waypoint.name}. Na hřebeni se nemáš kam schovat.`,
    })
  }
  if (hour.visibility !== null && hour.visibility < 300) {
    issues.push({
      key: 'mlha',
      severity: 'blok',
      text: `Viditelnost ${Math.round(hour.visibility)} m — ${waypoint.name}. Bez GPS se tam ztratíš.`,
    })
  }
  if (hour.apparentTemperature <= -15 && hour.windGusts >= 50) {
    issues.push({
      key: 'omrzliny',
      severity: 'blok',
      text: `Pocitově ${Math.round(hour.apparentTemperature)} °C při nárazech ${Math.round(hour.windGusts)} km/h — riziko omrzlin.`,
    })
  }

  // Měkká varování.
  if (!issues.some((i) => i.key === 'vitr') && hour.windGusts >= 50) {
    issues.push({
      key: 'vitr',
      severity: 'varovani',
      text: `Nárazy ${Math.round(hour.windGusts)} km/h — ${waypoint.name}. Vezmi větrovku.`,
    })
  }
  if (!issues.some((i) => i.key === 'bourka') && hour.cape >= 500) {
    issues.push({
      key: 'bourka',
      severity: 'varovani',
      text: `Zvýšené riziko bouřek (CAPE ${Math.round(hour.cape)}) — ${waypoint.name}. Buď dole do poledne.`,
    })
  }
  if (hour.precipitation >= 1) {
    issues.push({
      key: 'srazky',
      severity: 'varovani',
      text: `Srážky ${hour.precipitation.toFixed(1)} mm — ${waypoint.name}.`,
    })
  }
  if (icingPenalty(hour, waypoint.elevation) > 0) {
    issues.push({
      key: 'namraza',
      severity: 'varovani',
      text: `Nulová izoterma je pod vrcholem a prší — počítej s námrazou na kamenech.`,
    })
  }

  return { score: Math.round(clamp(100 - penalty, 0, 100)), issues, penalties }
}

export interface RouteScore {
  score: number
  verdict: Verdict
  blockers: Issue[]
  warnings: Issue[]
  /** Nejhorší bod trasy — ten, který skóre stáhl dolů. */
  weakest: { waypoint: Waypoint; hour: HourPoint; score: number; penalties: Penalty[] } | null
}

/**
 * Skóre celé trasy. Bere 60 % z nejhoršího místa a 40 % z průměru:
 * túra je tak dobrá, jak dobrý je její nejhorší úsek, ale jedna špatná hodina
 * z osmi hezkých ještě neznamená katastrofu.
 */
export function scoreRoute(
  points: Array<{ waypoint: Waypoint; hour: HourPoint }>,
): RouteScore {
  if (points.length === 0) {
    return { score: 0, verdict: 'nejdi', blockers: [], warnings: [], weakest: null }
  }

  const scored = points.map((p) => ({ ...p, ...scoreHour(p.hour, p.waypoint) }))
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
