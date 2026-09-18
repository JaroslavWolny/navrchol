import type { HourPoint } from './types'

export type SkyLabel = 'paráda' | 'slušný' | 'průměr' | 'nic moc'

export interface SkyScore {
  score: number
  label: SkyLabel
  reason: string
  layers: { high: number; mid: number; low: number }
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * Barvu při východu a západu dělá oblačnost, do které se sluneční paprsky opřou zespodu.
 * Ideál je kolem 45 % — čistá obloha je fádní, zatažená nepustí světlo skrz.
 */
function colorCurve(cover: number): number {
  return clamp(1 - Math.abs(cover - 45) / 55, 0, 1)
}

/** Zákal z vlhkosti a zhoršené dohlednosti barvy vymyje. */
function clarity(hour: HourPoint): number {
  if (hour.visibility !== null) return clamp(hour.visibility / 20000, 0.55, 1)
  return 1 - clamp((hour.humidity - 70) / 40, 0, 0.35)
}

export function scoreSky(hour: HourPoint): SkyScore {
  const layers = {
    high: Math.round(hour.cloudHigh),
    mid: Math.round(hour.cloudMid),
    low: Math.round(hour.cloudLow),
  }

  const colorPotential = 0.65 * colorCurve(layers.high) + 0.35 * colorCurve(layers.mid)
  // Nízká oblačnost je jediná, která dokáže představení zrušit úplně — zacloní obzor.
  // Proto násobí, nepřičítá: když je obzor zavřený, nepomůže sebehezčí cirrus nad hlavou.
  const horizonClear = 1 - clamp((layers.low - 10) / 55, 0, 1)
  // Základ 0,25 je za čistý sluneční kotouč — i obloha bez mráčku za něco stojí, jen není barevná.
  const score = Math.round(100 * (0.25 + 0.75 * colorPotential) * horizonClear * clarity(hour))

  return { score, label: labelOf(score), reason: reasonOf(layers, score), layers }
}

function labelOf(score: number): SkyLabel {
  if (score >= 75) return 'paráda'
  if (score >= 55) return 'slušný'
  if (score >= 30) return 'průměr'
  return 'nic moc'
}

function reasonOf(l: { high: number; mid: number; low: number }, score: number): string {
  if (l.low > 65) return 'Nízká oblačnost zacloní obzor, slunce vůbec neuvidíš.'
  if (l.high + l.mid < 10) return 'Obloha bez mráčku — čisté, ale barvy se nemají do čeho opřít.'
  // Skóre rozhoduje dřív než součet vrstev. Vysoká a střední oblačnost jsou
  // dvě nezávislá procenta, ne jedna pokrývka: 63 % vysoké a 34 % střední
  // dá v součtu 97, přitom obě leží blízko ideálu a obloha bude nádherná.
  // Bez tohohle pořadí dostal východ se skóre 79 komentář „zataženo až nahoru".
  if (score >= 75) return 'Vysoká oblačnost chytne barvu a nízká skoro žádná není, takže nic nezacloní obzor.'
  if (l.high + l.mid > 90) return 'Zataženo až nahoru, světlo se skrz to nedostane.'
  if (l.low > 30) return 'Vysoko to vypadá dobře, ale nízká oblačnost může obzor přikrýt.'
  return 'Slušné rozložení oblačnosti, barvy by mohly být.'
}
