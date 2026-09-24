export type PaceKey = 'pomale' | 'stredni' | 'svizne'

export interface Waypoint {
  id: string
  name: string
  lat: number
  lon: number
  /** Nadmořská výška v metrech. Zásadní — bez ní je předpověď pro hory nepoužitelná. */
  elevation: number
}

/** Bod trati: zeměpisná šířka, délka a nadmořská výška. */
export interface TrackPoint {
  lat: number
  lon: number
  elevation: number
}

export interface Route {
  id: string
  name: string
  waypoints: Waypoint[]
  /** "HH:MM" v lokálním čase trasy. */
  startTime: string
  pace: PaceKey
  /**
   * Vracíš se po stejné trati? Pak se počítá i cesta zpátky — do času, do rezervy
   * do tmy i do toho, které hodiny se vůbec oskórují.
   */
  roundTrip?: boolean
  /** Pauza na nejvyšším bodě v minutách. Sedíš na hřebeni, takže se skóruje i ona. */
  breakMin?: number
  /**
   * Trať z importovaného GPX. Když je, nepočítá se trasa po pěšinách, ale jde se
   * přesně tudy — tak, jak si ji člověk naplánoval v Mapy.cz nebo jinde.
   */
  track?: TrackPoint[]
}

/**
 * Místo podél trati, pro které se stahuje předpověď. Dřív se počasí bralo jen
 * v bodech, které si člověk naklikal — u trasy start → vrchol pak hřeben mezi
 * nimi neměl vlastní předpověď vůbec. Teď se trať vzorkuje po kilometrech
 * a vždy se přidá nejvyšší a nejnižší místo.
 */
export interface ForecastSite {
  id: string
  lat: number
  lon: number
  elevation: number
  /** Index v jednosměrné trati. */
  trackIndex: number
}

/**
 * Jedna hodina předpovědi v jednom místě trati.
 *
 * Tvar počasí (teplota, oblačnost, dohlednost, nulová izoterma) je z nejjemnějšího
 * modelu, který na dané místo dosáhne. Veličiny, na kterých stojí rozhodnutí, mají
 * navíc kvantily z ansámblu: hodnota bez přípony je z modelu, `*Risk` je nepříznivý
 * kvartil — a právě z něj se skóruje. `*High` je devátý decil pro chvostové varování.
 */
export interface HourPoint {
  time: string
  temperature: number
  apparentTemperature: number
  /** Chladná strana ansámblu (p25). */
  apparentTemperatureRisk: number
  /** mm/h. */
  precipitation: number
  /** mm/h, p75. */
  precipitationRisk: number
  /** Kolika procentům členů ansámblu v tuhle hodinu prší (> 0,2 mm/h). */
  precipitationProbability: number
  /** cm/h. */
  snowfall: number
  /** cm/h, p75. */
  snowfallRisk: number
  windSpeed: number
  /** Odkud fouká, ve stupních. */
  windDirection: number
  windGusts: number
  windGustsRisk: number
  windGustsHigh: number
  /**
   * Vítr je dopočítaný z volné atmosféry, ne z modelové desetimetrové hladiny.
   * Na Sněžce model v 10 m ukazuje v průměru 4,4 m/s, naměřeno je 10,2 m/s.
   */
  ridgeWind: boolean
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
  /**
   * Teplota po tlakových hladinách i s jejich nadmořskou výškou. Z toho se pozná
   * inverze: běžně teplota s výškou klesá, v inverzi roste.
   */
  levels: Array<{ height: number; temperature: number }>
  /** Optická tloušťka aerosolu — zákal pro dálky. Null = data nedorazila. */
  aerosol: number | null
  /** Kolik členů ansámblu tuhle hodinu pokrylo. 0 = ansámbl tak daleko nedosáhl. */
  members: number
}

/**
 * Šířka ansámblu mezi prvním a devátým decilem. Čím širší, tím menší jistota.
 */
export interface Spread {
  temperature: number
  windGusts: number
  precipitation: number
  members: number
}

export interface PointForecast {
  siteId: string
  hours: HourPoint[]
  spread: Spread[]
}

export interface DayInfo {
  date: string
  sunrise: string
  sunset: string
}
