/**
 * Poloha Slunce a Měsíce nad obzorem.
 *
 * Open-Meteo dává jen východ a západ pro rovný obzor. Fotograf potřebuje víc:
 * kdy začíná modrá a zlatá hodina, kdy je obloha doopravdy tmavá a kde na obzoru
 * to všechno bude. To se nedá stáhnout, musí se spočítat.
 *
 * Přesnost: Slunce do desetiny stupně, Měsíc do zhruba půl stupně — na časy
 * s minutovou přesností to stačí a na kompozici taky. Časy jsou v lokálním čase
 * zařízení, stejně jako všude jinde v appce.
 */

const RAD = Math.PI / 180

/** Výška nad obzorem a azimut od severu po směru hodinových ručiček, ve stupních. */
export interface SkyPosition {
  altitude: number
  azimuth: number
}

const julianDay = (at: Date) => at.getTime() / 86_400_000 + 2440587.5

/** Rovníkové souřadnice Slunce (rektascenze a deklinace v radiánech). */
function sunEquatorial(jd: number): { ra: number; dec: number; lambda: number } {
  const n = jd - 2451545.0
  const meanLon = (280.46 + 0.9856474 * n) * RAD
  const anomaly = (357.528 + 0.9856003 * n) * RAD
  const lambda = meanLon + (1.915 * Math.sin(anomaly) + 0.02 * Math.sin(2 * anomaly)) * RAD
  const obliquity = (23.439 - 0.0000004 * n) * RAD
  return {
    ra: Math.atan2(Math.cos(obliquity) * Math.sin(lambda), Math.cos(lambda)),
    dec: Math.asin(Math.sin(obliquity) * Math.sin(lambda)),
    lambda,
  }
}

/**
 * Měsíc podle zkrácené Meeusovy řady. Pro rozhodnutí „svítí, nebo je tma"
 * je to víc než dost; na zákryty by to nestačilo.
 */
function moonEquatorial(jd: number): { ra: number; dec: number; lambda: number } {
  const d = jd - 2451545.0
  const lon = (218.316 + 13.176396 * d) * RAD
  const anomaly = (134.963 + 13.064993 * d) * RAD
  const node = (93.272 + 13.22935 * d) * RAD

  const lambda = lon + 6.289 * RAD * Math.sin(anomaly)
  const beta = 5.128 * RAD * Math.sin(node)
  const obliquity = (23.439 - 0.0000004 * d) * RAD

  const ra = Math.atan2(
    Math.sin(lambda) * Math.cos(obliquity) - Math.tan(beta) * Math.sin(obliquity),
    Math.cos(lambda),
  )
  const dec = Math.asin(
    Math.sin(beta) * Math.cos(obliquity) + Math.cos(beta) * Math.sin(obliquity) * Math.sin(lambda),
  )
  return { ra, dec, lambda }
}

/** Hvězdný čas v Greenwichi, v hodinách. */
const gmstHours = (jd: number) => (18.697374558 + 24.06570982441908 * (jd - 2451545.0)) % 24

/** Z rovníkových souřadnic na to, co vidíš: výška nad obzorem a azimut. */
function horizontal(ra: number, dec: number, lat: number, lon: number, jd: number): SkyPosition {
  const lst = (((gmstHours(jd) + lon / 15) % 24) + 24) % 24
  const hourAngle = lst * 15 * RAD - ra
  const phi = lat * RAD

  const altitude = Math.asin(
    Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(hourAngle),
  )
  // Azimut od jihu; posun o 180° ho překlopí na obvyklé počítání od severu.
  const azimuth = Math.atan2(
    Math.sin(hourAngle),
    Math.cos(hourAngle) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi),
  )
  return {
    altitude: altitude / RAD,
    azimuth: (((azimuth / RAD + 180) % 360) + 360) % 360,
  }
}

export function sunPosition(lat: number, lon: number, at: Date): SkyPosition {
  const jd = julianDay(at)
  const { ra, dec } = sunEquatorial(jd)
  return horizontal(ra, dec, lat, lon, jd)
}

export function moonPosition(lat: number, lon: number, at: Date): SkyPosition {
  const jd = julianDay(at)
  const { ra, dec } = moonEquatorial(jd)
  return horizontal(ra, dec, lat, lon, jd)
}

/**
 * Jádro Mléčné dráhy (střed Galaxie). Jeho souřadnice se nehýbou, takže stačí
 * jedna transformace — a z ní vyjde, jestli má v noci vůbec cenu tahat stativ.
 */
export function milkyWayCore(lat: number, lon: number, at: Date): SkyPosition {
  const ra = (17 + 45.7 / 60) * 15 * RAD
  const dec = -29.0 * RAD
  return horizontal(ra, dec, lat, lon, julianDay(at))
}

/** Osvětlená část měsíčního kotouče (0 = nov, 1 = úplněk) a jestli dorůstá. */
export function moonIllumination(at: Date): { fraction: number; waxing: boolean; label: string } {
  const jd = julianDay(at)
  const elongation = moonEquatorial(jd).lambda - sunEquatorial(jd).lambda
  const fraction = (1 - Math.cos(elongation)) / 2
  const waxing = Math.sin(elongation) > 0
  return { fraction, waxing, label: phaseLabel(fraction, waxing) }
}

function phaseLabel(fraction: number, waxing: boolean): string {
  if (fraction < 0.04) return 'nov'
  if (fraction > 0.96) return 'úplněk'
  if (fraction < 0.35) return waxing ? 'dorůstající srpek' : 'ubývající srpek'
  if (fraction < 0.65) return waxing ? 'první čtvrt' : 'poslední čtvrt'
  return waxing ? 'dorůstající' : 'ubývající'
}

/** Půlnoc daného dne v lokálním čase. */
const midnight = (day: Date): Date => {
  const d = new Date(day)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Kdy těleso protne danou výšku nad obzorem. Hledá se hrubě po minutách a pak
 * se půlením zpřesní na vteřiny — řešit to analyticky by bylo přesnější
 * a nečitelné, a na minutu je to stejně jedno.
 */
export function crossings(
  day: Date,
  position: (at: Date) => SkyPosition,
  angle: number,
): { rise: Date | null; set: Date | null } {
  const start = midnight(day).getTime()
  const step = 60_000
  let rise: Date | null = null
  let set: Date | null = null

  let previous = position(new Date(start)).altitude - angle
  for (let i = 1; i <= 1440; i++) {
    const t = start + i * step
    const current = position(new Date(t)).altitude - angle
    if (previous < 0 && current >= 0 && !rise) rise = refine(t - step, t, position, angle)
    if (previous >= 0 && current < 0) set = refine(t - step, t, position, angle)
    previous = current
  }
  return { rise, set }
}

function refine(
  from: number,
  to: number,
  position: (at: Date) => SkyPosition,
  angle: number,
): Date {
  let lo = from
  let hi = to
  for (let i = 0; i < 8; i++) {
    const mid = (lo + hi) / 2
    const above = position(new Date(mid)).altitude - angle >= 0
    const loAbove = position(new Date(lo)).altitude - angle >= 0
    if (above === loAbove) lo = mid
    else hi = mid
  }
  return new Date(Math.round((lo + hi) / 2 / 1000) * 1000)
}

/** Výška slunce, při které se počítá východ a západ — půl kotouče a refrakce. */
export const SUNRISE_ANGLE = -0.833
/** Konec občanského soumraku: hranice modré hodiny. */
export const BLUE_ANGLE = -6
/** Konec astronomického soumraku: od téhle chvíle je obloha doopravdy tmavá. */
export const DARK_ANGLE = -18
/** Konec zlatého světla — výš už je slunce tvrdé. */
export const GOLDEN_ANGLE = 6

export interface LightWindow {
  from: Date
  to: Date
}

export interface DayLight {
  sunrise: Date | null
  sunset: Date | null
  blueMorning: LightWindow | null
  goldenMorning: LightWindow | null
  goldenEvening: LightWindow | null
  blueEvening: LightWindow | null
  /** Obloha bez slunečního svitu — astronomická tma. */
  night: LightWindow | null
}

/**
 * Světelná okna dne. Zlatá hodina není hodina a modrá taky ne: v červnu na
 * padesáté rovnoběžce trvá zlaté světlo skoro hodinu a půl, v prosinci čtyřicet
 * minut. Appka je proto počítá, místo aby od východu odečítala paušál.
 */
export function dayLight(lat: number, lon: number, day: Date): DayLight {
  const at = (a: Date) => sunPosition(lat, lon, a)
  const sun = crossings(day, at, SUNRISE_ANGLE)
  const blue = crossings(day, at, BLUE_ANGLE)
  const golden = crossings(day, at, GOLDEN_ANGLE)
  const dark = crossings(day, at, DARK_ANGLE)

  const window = (from: Date | null, to: Date | null): LightWindow | null =>
    from && to && to > from ? { from, to } : null

  return {
    sunrise: sun.rise,
    sunset: sun.set,
    blueMorning: window(blue.rise, sun.rise),
    goldenMorning: window(sun.rise, golden.rise),
    goldenEvening: window(golden.set, sun.set),
    blueEvening: window(sun.set, blue.set),
    // Tma trvá přes půlnoc, takže konec patří už dalšímu dni.
    night: window(dark.set, dark.rise ? addDays(dark.rise, 1) : null),
  }
}

const addDays = (d: Date, days: number) => new Date(d.getTime() + days * 86_400_000)

export interface MoonInfo {
  fraction: number
  label: string
  rise: Date | null
  set: Date | null
  /** Kolik procent oblohy měsíc přesvítí — 0 když je pod obzorem celou noc. */
  brightness: number
}

/** Výška, při které Měsíc vychází — kotouč a paralaxa proti refrakci. */
const MOONRISE_ANGLE = 0.125

export function moonInfo(lat: number, lon: number, day: Date): MoonInfo {
  const { fraction, label } = moonIllumination(midnight(day))
  const { rise, set } = crossings(day, (at) => moonPosition(lat, lon, at), MOONRISE_ANGLE)
  return { fraction, label, rise, set, brightness: Math.round(fraction * 100) }
}
