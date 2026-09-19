import type { HourPoint } from './types'

/**
 * Inverze a moře mlhy.
 *
 * Nejfotogeničtější stav českých hor: v údolí mlha, na hřebeni slunce a nad tím
 * čistá obloha. Pozná se z teplotního profilu — běžně teplota s výškou klesá
 * o 6,5 °C na kilometr, v inverzi roste. Horní hrana té vrstvy je hladina mlhy.
 */

/** Běžný pokles teploty s výškou, °C na metr. */
const NORMAL_LAPSE = -0.0065
/** Vrstva, která je aspoň takhle blízko izotermii, se počítá jako inverzní. */
const STABLE_LAPSE = -0.001
/** Výš než tohle už to není inverze v údolí, ale počasí nad horami. */
const MAX_TOP_M = 2200

export interface Inversion {
  /** Horní hrana inverzní vrstvy — pod ní bývá mlha. */
  topM: number
  /** Spodek vrstvy. */
  baseM: number
  /** O kolik je nahoře tepleji než dole, ve stupních. */
  strengthK: number
}

/** Najde nejnižší inverzní vrstvu v profilu. Null = teplota klesá normálně. */
export function inversionIn(levels: HourPoint['levels']): Inversion | null {
  const sorted = [...levels].sort((a, b) => a.height - b.height)
  if (sorted.length < 2) return null

  for (let i = 0; i < sorted.length - 1; i++) {
    const base = sorted[i]
    if (base.height > MAX_TOP_M) break

    const lapse = (sorted[i + 1].temperature - base.temperature) / (sorted[i + 1].height - base.height)
    if (lapse <= STABLE_LAPSE) continue

    // Vrstva pokračuje, dokud se teplota nezačne chovat zase normálně.
    let top = i + 1
    while (
      top < sorted.length - 1 &&
      (sorted[top + 1].temperature - sorted[top].temperature) /
        (sorted[top + 1].height - sorted[top].height) >
        STABLE_LAPSE
    ) {
      top++
    }
    return {
      baseM: Math.round(base.height),
      topM: Math.round(sorted[top].height),
      strengthK: Number((sorted[top].temperature - base.temperature).toFixed(1)),
    }
  }
  return null
}

export interface FogSea {
  topM: number
  strengthK: number
  /** 0—100, jak moc to vypadá na moře mlhy. */
  chance: number
  /** Jsi nad hladinou? Pod ní je to jen mlha, nad ní je to fotka. */
  above: boolean
  reason: string
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * Šance na moře mlhy v danou hodinu z pohledu daného bodu.
 *
 * Samotná inverze nestačí — musí být z čeho mlhu udělat (vlhko a nízká
 * oblačnost) a nesmí ji rozfoukat vítr. A hlavně: musíš být nad hladinou,
 * jinak stojíš v mlze a fotíš bílou zeď.
 */
export function fogSeaAt(hour: HourPoint, elevation: number): FogSea | null {
  const inversion = inversionIn(hour.levels)
  if (!inversion) return null

  // Silná inverze drží mlhu pohromadě, slabá ji nechá rozpustit.
  const strength = clamp(inversion.strengthK / 4, 0, 1)
  // Musí být z čeho mlhu udělat: buď ji model rovnou hlásí jako nízkou
  // oblačnost, nebo je aspoň vlhko na to, aby vznikla přes noc.
  const deck = Math.max(clamp(hour.cloudLow / 70, 0, 1), clamp((hour.humidity - 80) / 15, 0, 1))
  // Vítr nad pětadvacet inverzi promíchá a je po představení.
  const calm = 1 - clamp((hour.windGusts - 10) / 25, 0, 1)

  const chance = Math.round(100 * strength * (0.35 + 0.65 * deck) * (0.4 + 0.6 * calm))
  const above = elevation > inversion.topM + 50

  return {
    topM: inversion.topM,
    strengthK: inversion.strengthK,
    chance,
    above,
    reason: reasonOf(chance, above, inversion, hour),
  }
}

function reasonOf(chance: number, above: boolean, inversion: Inversion, hour: HourPoint): string {
  if (!above) {
    return `Hladina mlhy kolem ${inversion.topM} m je nad tebou — budeš uvnitř, ne nad ní.`
  }
  if (chance >= 60) {
    return `Inverze ${inversion.strengthK} °C s hladinou kolem ${inversion.topM} m. Pod sebou máš mít mlhu, nad sebou čisto.`
  }
  if (hour.windGusts > 30) {
    return `Inverze tam je, ale nárazy ${Math.round(hour.windGusts)} km/h ji nejspíš rozfoukají.`
  }
  if (chance >= 30) {
    return `Inverze slabší (${inversion.strengthK} °C). Moře mlhy může být, ale nespoléhej na něj.`
  }
  return `Teplotní profil je stabilní, ale na mlhu je moc sucho.`
}

/**
 * Jak daleko uvidíš. Dohlednost z modelu měří přízemní vrstvu, na vrstvení
 * vzdálených hřebenů rozhoduje zákal celého sloupce — ten nese aerosol.
 */
export function haze(hour: HourPoint): { rangeKm: number; label: string } | null {
  if (hour.aerosol === null) return null
  const aod = hour.aerosol
  const rangeKm = aod <= 0 ? 150 : clamp(Math.round(22 / Math.max(aod, 0.02)), 8, 200)
  const label =
    aod < 0.08
      ? 'průzračno, vrstvy hor až za obzor'
      : aod < 0.18
        ? 'čisto, vzdálené hřebeny budou čitelné'
        : aod < 0.35
          ? 'mírný zákal, dálky změknou'
          : 'zákal, dál než pár desítek kilometrů nic'
  return { rangeKm, label }
}
