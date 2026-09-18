export interface GearItem {
  name: string
  why: string
}

export interface GearContext {
  minApparent: number
  maxGusts: number
  totalPrecip: number
  maxPrecipProbability: number
  maxUv: number
  minVisibility: number | null
  anyIcing: boolean
  startsBeforeSunrise: boolean
  endsAfterSunset: boolean
  durationMin: number
  highestName: string
  highestElevation: number
}

/**
 * Výbava navíc, kterou si vynutily podmínky. Každá položka nese důvod,
 * aby bylo vidět, proč tam je — a aby se dala zpochybnit.
 */
export function suggestGear(c: GearContext): GearItem[] {
  const items: GearItem[] = []
  const add = (name: string, why: string) => items.push({ name, why })

  if (c.maxGusts >= 40) {
    add('Větrovka', `nárazy ${Math.round(c.maxGusts)} km/h na nejvyšším bodě trasy`)
  }
  if (c.minApparent <= 2) {
    add('Čepice a rukavice', `pocitově ${Math.round(c.minApparent)} °C na vrcholu`)
  }
  if (c.minApparent <= -8) {
    add('Termoska s teplým pitím', `pocitově ${Math.round(c.minApparent)} °C, na vrcholu se nenajíš v klidu`)
  }
  if (c.totalPrecip >= 0.3 || c.maxPrecipProbability >= 40) {
    add(
      'Pláštěnka',
      `srážky ${c.totalPrecip.toFixed(1)} mm, pravděpodobnost ${Math.round(c.maxPrecipProbability)} %`,
    )
  }
  if (c.startsBeforeSunrise || c.endsAfterSunset) {
    const kdy = c.startsBeforeSunrise ? 'nahoru jdeš za tmy' : 'vracíš se po západu'
    add('Čelovka s náhradní baterií', kdy)
  }
  if (c.maxUv >= 5) {
    add('Brýle a krém', `UV index ${Math.round(c.maxUv)}, nad hranicí lesa není stín`)
  }
  if (c.anyIcing) {
    add('Mikrohroty', `nulová izoterma je pod ${c.highestElevation} m a prší — kameny budou kluzké`)
  }
  if (c.minVisibility !== null && c.minVisibility < 1500) {
    add('Offline mapa a plná baterka', `dohlednost klesá na ${Math.round(c.minVisibility)} m`)
  }
  if (c.durationMin >= 300) {
    add('Jídlo a 2,5 l vody', `trasa na ${Math.round(c.durationMin / 60)} hodin`)
  }

  return items
}
