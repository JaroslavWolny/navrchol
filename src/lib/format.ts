const MINUS = '−'

/** České číslo s desetinnou čárkou. */
export function num(value: number, decimals = 0): string {
  return value.toLocaleString('cs-CZ', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/** Teplota s typografickým minusem, ne spojovníkem. */
export function temp(value: number): string {
  const rounded = Math.round(value)
  return `${rounded < 0 ? MINUS + Math.abs(rounded) : rounded} °C`
}

export function metres(value: number): string {
  return `${num(Math.round(value))} m`
}

export function km(value: number): string {
  return `${num(value, 1)} km`
}

export function clock(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

const DAYS = ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so']

/** "ne 20. 9." */
export function dayLabel(date: Date): string {
  return `${DAYS[date.getDay()]} ${date.getDate()}. ${date.getMonth() + 1}.`
}

/** "ne 20." — do úzkých sloupců. */
export function dayShort(date: Date): string {
  return `${DAYS[date.getDay()]} ${date.getDate()}.`
}

export function parseDay(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Český tvar podle počtu: 1 bod, 2—4 body, 5 a víc bodů. */
export function bodu(count: number): string {
  if (count === 1) return '1 bod'
  if (count >= 2 && count <= 4) return `${count} body`
  return `${count} bodů`
}
