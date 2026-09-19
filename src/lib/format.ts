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
  return `Vyrazit jsi měl před ${duration(-minutes)} — nahoře budeš až po začátku okna.`
}

/** "4 h 20 min", nebo "45 min" pod hodinu. Stejný tvar jako u délky túry. */
function duration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`
}

/** Český tvar podle počtu: 1 bod, 2—4 body, 5 a víc bodů. */
export function bodu(count: number): string {
  if (count === 1) return '1 bod'
  if (count >= 2 && count <= 4) return `${count} body`
  return `${count} bodů`
}
