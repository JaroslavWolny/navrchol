const R_EARTH = 6371

const rad = (d: number) => (d * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI

/** Vzdálenost dvou bodů po povrchu, v kilometrech. */
export function haversine(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R_EARTH * Math.asin(Math.sqrt(h))
}

/** Deklinace Slunce pro daný den v roce, ve stupních. Přesnost cca ±0,5°. */
export function solarDeclination(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0)
  const dayOfYear = Math.floor((date.getTime() - start) / 86400000)
  return 23.44 * Math.sin((2 * Math.PI * (dayOfYear - 81)) / 365.24)
}

/**
 * Azimut východu a západu Slunce ve stupních od severu.
 * Geometrický horizont — refrakci a převýšení okolních kopců neřeší.
 */
export function sunAzimuths(lat: number, date: Date): { sunrise: number; sunset: number } {
  const dec = rad(solarDeclination(date))
  const cosA = Math.sin(dec) / Math.cos(rad(lat))
  // Za polárním kruhem slunce nevyjde ani nezapadne.
  const clamped = Math.max(-1, Math.min(1, cosA))
  const sunrise = deg(Math.acos(clamped))
  return { sunrise, sunset: 360 - sunrise }
}

const COMPASS = ['S', 'SV', 'V', 'JV', 'J', 'JZ', 'Z', 'SZ']

/** Azimut na českou zkratku světové strany. */
export function compassPoint(azimuth: number): string {
  const i = Math.round(((azimuth % 360) + 360) % 360 / 45) % 8
  return COMPASS[i]
}
