export type PaceKey = 'pomale' | 'stredni' | 'svizne'

export interface Waypoint {
  id: string
  name: string
  lat: number
  lon: number
  /** Nadmořská výška v metrech. Zásadní — bez ní je předpověď pro hory nepoužitelná. */
  elevation: number
}

export interface Route {
  id: string
  name: string
  waypoints: Waypoint[]
  /** "HH:MM" v lokálním čase trasy. */
  startTime: string
  pace: PaceKey
}

/**
 * Jedna hodina předpovědi v jednom bodě trasy.
 *
 * Tvar počasí (teplota, oblačnost, dohlednost, nulová izoterma) je z nejjemnějšího
 * modelu, který na dané místo dosáhne. Veličiny, na kterých stojí rozhodnutí, mají
 * navíc kvantily z ansámblu: hodnota bez přípony je medián, `*Risk` je nepříznivý
 * kvartil — a právě z něj se skóruje, protože túra se plánuje na horší variantu,
 * ne na tu nejpravděpodobnější. `*High` je devátý decil pro chvostové varování.
 */
export interface HourPoint {
  time: string
  temperature: number
  apparentTemperature: number
  /** Chladná strana ansámblu (p25). */
  apparentTemperatureRisk: number
  /** mm/h, medián ansámblu. */
  precipitation: number
  /** mm/h, p75. */
  precipitationRisk: number
  /** Kolika procentům členů ansámblu v tuhle hodinu prší (> 0,2 mm/h). */
  precipitationProbability: number
  /** cm/h, medián. */
  snowfall: number
  /** cm/h, p75. */
  snowfallRisk: number
  windSpeed: number
  windGusts: number
  windGustsRisk: number
  windGustsHigh: number
  cape: number
  capeRisk: number
  cloudCover: number
  cloudLow: number
  cloudMid: number
  cloudHigh: number
  visibility: number | null
  freezingLevel: number | null
  /** Výška sněhu na zemi v metrech. */
  snowDepth: number
  humidity: number
  uvIndex: number
  /** Kolik členů ansámblu tuhle hodinu pokrylo. 0 = ansámbl tak daleko nedosáhl. */
  members: number
}

/**
 * Šířka ansámblu mezi prvním a devátým decilem. Čím širší, tím menší jistota —
 * a na rozdíl od porovnávání různě jemných modelů to fakt měří nejistotu, ne rozlišení.
 */
export interface Spread {
  temperature: number
  windGusts: number
  precipitation: number
  members: number
}

export interface PointForecast {
  waypointId: string
  hours: HourPoint[]
  spread: Spread[]
}

export interface DayInfo {
  date: string
  sunrise: string
  sunset: string
}
