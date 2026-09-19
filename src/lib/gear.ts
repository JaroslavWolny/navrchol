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
  /** Nejvyšší sněhová pokrývka na trase, v metrech. */
  maxSnowDepth: number
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
    add('Větrovka', `nárazy ${Math.round(c.maxGusts)} km/h v nejhorší hodině trasy`)
  }
  if (c.minApparent <= 2) {
    add('Čepice a rukavice', `pocitově ${Math.round(c.minApparent)} °C v nejchladnější hodině`)
  }
  if (c.minApparent <= -8) {
    add('Termoska s teplým pitím', `pocitově ${Math.round(c.minApparent)} °C, venku se v klidu nenajíš`)
  }
  if (c.totalPrecip >= 0.3 || c.maxPrecipProbability >= 40) {
    add(
      'Pláštěnka',
      `srážky ${c.totalPrecip.toFixed(1)} mm, pravděpodobnost ${Math.round(c.maxPrecipProbability)} %`,
    )
  }
  // Promočený člověk se v horách nezahřeje pohybem. Suchá vrstva do batohu je
  // rozdíl mezi nepohodou a podchlazením.
  if (c.totalPrecip >= 3) {
    add('Suché náhradní vršek a ponožky', `za túru na tebe spadne ${c.totalPrecip.toFixed(1)} mm`)
  }
  if (c.maxSnowDepth >= 0.3) {
    add(
      c.maxSnowDepth >= 0.6 ? 'Sněžnice a návleky' : 'Návleky a vysoké boty',
      `na trase leží ${Math.round(c.maxSnowDepth * 100)} cm sněhu`,
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
