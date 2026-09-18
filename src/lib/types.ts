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

/** Jedna hodina předpovědi v jednom bodě, sloučená přes všechny modely. */
export interface HourPoint {
  time: string
  temperature: number
  apparentTemperature: number
  precipitation: number
  precipitationProbability: number
  windSpeed: number
  windGusts: number
  cape: number
  cloudCover: number
  cloudLow: number
  cloudMid: number
  cloudHigh: number
  visibility: number | null
  freezingLevel: number | null
  snowDepth: number
  humidity: number
  uvIndex: number
}

/** Rozptyl mezi modely — čím větší, tím míň se dá předpovědi věřit. */
export interface Spread {
  temperature: number
  windGusts: number
  precipitation: number
  /** 0..100, kolik procent shody modely mají. */
  agreement: number
}

export interface ModelSeries {
  temperature: Array<number | null>
  windGusts: Array<number | null>
  precipitation: Array<number | null>
}

export interface PointForecast {
  waypointId: string
  hours: HourPoint[]
  spread: Spread[]
  /** Které modely data skutečně vrátily. */
  models: string[]
  /** Syrové řady po modelech — bez nich by nešlo ukázat, který model se vymyká. */
  byModel: Record<string, ModelSeries>
}

export interface DayInfo {
  date: string
  sunrise: string
  sunset: string
}
