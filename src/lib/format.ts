const MINUS = '−'
/** Pevná mezera — číslo se nesmí odtrhnout od jednotky na konci řádku. */
export const NBSP = ' '

/** České číslo s desetinnou čárkou. */
export function num(value: number, decimals = 0): string {
  return value.toLocaleString('cs-CZ', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/** Znaménko jako typografické minus, ne spojovník. */
export function signed(value: number, decimals = 0): string {
  const s = num(Math.abs(value), decimals)
  return value < 0 && s !== num(0, decimals) ? MINUS + s : s
}

/** Teplota s typografickým minusem. */
export function temp(value: number): string {
  return `${signed(Math.round(value))}${NBSP}°C`
}

/** Teplota do úzkých sloupců: „−3°". */
export function deg(value: number): string {
  return `${signed(Math.round(value))}°`
}

export function metres(value: number): string {
  return `${num(Math.round(value))}${NBSP}m`
}

export function km(value: number): string {
  return `${num(value, value < 10 ? 1 : 0)}${NBSP}km`
}

/** „7:05" — česky bez úvodní nuly u hodin. */
export function clock(date: Date): string {
  return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`
}

/** „07:05" pro `<input type="time">`. */
export function hhmm(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

const DAYS = ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so']
const DAYS_LONG = ['neděle', 'pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota']

export const weekday = (date: Date) => DAYS[date.getDay()]
export const weekdayLong = (date: Date) => DAYS_LONG[date.getDay()]
export const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

/** Kolik dní je od dneška: 0 dnes, 1 zítra. */
export function daysFromToday(date: Date, now = new Date()): number {
  return Math.round((startOfDay(date) - startOfDay(now)) / 86_400_000)
}

/** „dnes", „zítra", „so 26. 9." */
export function dayLabel(date: Date, now = new Date()): string {
  const d = daysFromToday(date, now)
  if (d === 0) return 'dnes'
  if (d === 1) return 'zítra'
  return `${DAYS[date.getDay()]}${NBSP}${date.getDate()}.${NBSP}${date.getMonth() + 1}.`
}

/** „ne 20." — do úzkých sloupců. */
export function dayShort(date: Date): string {
  return `${DAYS[date.getDay()]} ${date.getDate()}.`
}

export function parseDay(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** „4 h 20 min", nebo „45 min" pod hodinu. */
export function duration(minutes: number): string {
  const total = Math.round(Math.abs(minutes))
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m}${NBSP}min`
  return m === 0 ? `${h}${NBSP}h` : `${h}${NBSP}h ${m}${NBSP}min`
}

/** Kompaktní délka: „4:20 h". */
export function durationShort(minutes: number): string {
  const total = Math.round(Math.abs(minutes))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}${NBSP}h`
}

/** Jak staré jsou data: „před 5 min", „před 2 h", „včera v 18:10". */
export function ago(at: number, now = Date.now()): string {
  const min = Math.round((now - at) / 60000)
  if (min < 1) return 'právě teď'
  if (min < 60) return `před ${min}${NBSP}min`
  const d = new Date(at)
  const days = daysFromToday(d, new Date(now))
  if (days === 0) return `v ${clock(d)}`
  if (days === -1) return `včera v ${clock(d)}`
  return `${dayLabel(d, new Date(now))} v ${clock(d)}`
}

/** „z 14:16", „ze včerejška, 18:10", „z 22. 9., 18:10" — odkud předpověď je. */
export function fromWhen(at: number, now = Date.now()): string {
  const d = new Date(at)
  const days = daysFromToday(d, new Date(now))
  if (days === 0) return `z ${clock(d)}`
  if (days === -1) return `ze včerejška, ${clock(d)}`
  return `z ${d.getDate()}.${NBSP}${d.getMonth() + 1}., ${clock(d)}`
}

/**
 * Odpočet ke světlu. Dává smysl jen v den samotné události — na předpověď za
 * tři dny se odpočet nehodí, tam se plánuje, ne pospíchá.
 */
export function countdown(now: Date, leaveAt: Date, eventAt: Date): string | null {
  const sameDay =
    now.getFullYear() === eventAt.getFullYear() &&
    now.getMonth() === eventAt.getMonth() &&
    now.getDate() === eventAt.getDate()
  if (!sameDay || now >= eventAt) return null

  const minutes = Math.round((leaveAt.getTime() - now.getTime()) / 60000)
  if (minutes > 0) return `Do odchodu zbývá ${duration(minutes)}.`
  if (minutes > -15) return 'Vyrazit máš právě teď.'
  return `Na začátek okna už nestihneš dojít, jsi ${duration(-minutes)} pozadu.`
}

/** Český tvar podle počtu: 1 bod, 2–4 body, 5 a víc bodů. */
export function plural(count: number, one: string, few: string, many: string): string {
  if (count === 1) return `${count}${NBSP}${one}`
  if (count >= 2 && count <= 4) return `${count}${NBSP}${few}`
  return `${count}${NBSP}${many}`
}

export const bodu = (count: number) => plural(count, 'bod', 'body', 'bodů')

/**
 * Česká sazba: jednopísmenné předložky a spojky nesmí zůstat na konci řádku.
 * Používá se na delší texty, které se lámou.
 */
export function vlna(text: string): string {
  return text.replace(/(?<=^|[\s(])([kvszouaiKVSZOUAI])\s+/g, `$1${NBSP}`)
}
