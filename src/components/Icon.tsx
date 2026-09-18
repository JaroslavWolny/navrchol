import type { JSX } from 'react'

/**
 * Vlastní sada, ne stažený balík.
 *
 * Společná řeč: mřížka 24, tah 1,75, **hranaté konce a ostré rohy**. Zaoblené
 * konce (výchozí u Featheru i Lucide) dělají ikonu měkkou a přátelskou —
 * tahle appka ale měří, takže kreslí jako technický výkres. Díky tomu se sada
 * pozná i vedle systémových ikon iOS.
 *
 * Ikony záložek jsou doslovné: „kdy jít" je sloupcový graf hodin, jak ho
 * obrazovka opravdu ukazuje, a „výbava" je odškrtaný seznam, protože přesně
 * tím ta obrazovka je. Batoh se v téhle velikosti čte jako visací zámek.
 */
const PATHS: Record<string, JSX.Element> = {
  // ——— záložky ———
  trasy: <><path d="M3 6.5 9 4.5l6 2 6-2v13l-6 2-6-2-6 2v-13Z" /><path d="M9 4.5v13" /><path d="M15 6.5v13" /></>,
  verdikt: <><path d="M2 20h20" /><path d="m3.5 20 5.2-8 3 4 2.6-3.6L20.5 20" /><path d="M6.6 10.5h4.4v-4H6.6v4Z" fill="currentColor" stroke="none" /></>,
  kdy: <><path d="M2.5 20.5h19" /><path d="M4 18v-4.5" /><path d="M7.2 18V9" /><path d="M10.4 18V5.5" /><path d="M13.6 18v-6" /><path d="M16.8 18v-3" /><path d="M20 18v-5" /></>,
  slunce: <><path d="M12 3v3.5" /><path d="m5.6 8.6 2.4 2.4" /><path d="m18.4 8.6-2.4 2.4" /><path d="M2 17.5h20" /><path d="M7 17.5a5 5 0 0 1 10 0" /><path d="M5 21h14" /></>,
  vybava: <><path d="M4.5 4.5h15v15h-15z" /><path d="m7.5 9.5 1.8 1.8 3.4-3.6" /><path d="M14.5 16h5" /><path d="M7.5 16h4" /></>,

  // ——— ovládání ———
  plus: <><path d="M12 4.5v15" /><path d="M4.5 12h15" /></>,
  back: <path d="m14.5 4.5-7.5 7.5 7.5 7.5" />,
  chevron: <path d="m9 5.5 6.5 6.5L9 18.5" />,
  check: <path d="m4.5 12.5 4.8 5L19.5 6.5" />,
  edit: <><path d="M4 20h4L19 9l-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></>,
  trash: <><path d="M4 6.5h16" /><path d="M9.5 6.5v-2h5v2" /><path d="M6.5 6.5 7.5 20.5h9l1-14" /></>,
  refresh: <><path d="M20.5 12a8.5 8.5 0 1 1-2.9-6.4" /><path d="M20.5 3.5v5h-5" /></>,
  arrowUp: <><path d="M12 20V4.5" /><path d="m5.5 11 6.5-6.5 6.5 6.5" /></>,
  arrowDown: <><path d="M12 4v15.5" /><path d="M18.5 13 12 19.5 5.5 13" /></>,
  locate: <><path d="M12 4.5v3" /><path d="M12 16.5v3" /><path d="M19.5 12h-3" /><path d="M7.5 12h-3" /><path d="M12 6.5A5.5 5.5 0 1 1 6.5 12 5.5 5.5 0 0 1 12 6.5Z" /></>,

  // ——— veličiny ———
  clock: <><path d="M12 3.5A8.5 8.5 0 1 1 3.5 12 8.5 8.5 0 0 1 12 3.5Z" /><path d="M12 7v5.5l3.5 2" /></>,
  wind: <><path d="M3 8h11a3 3 0 1 0-3-3" /><path d="M3 13h15a3 3 0 1 1-3 3" /><path d="M3 18h8" /></>,
  drop: <path d="M12 3 6.5 10.5a6.5 6.5 0 0 0 11 0L12 3Z" />,
  eye: <><path d="M2 12s3.8-6.5 10-6.5S22 12 22 12s-3.8 6.5-10 6.5S2 12 2 12Z" /><path d="M12 9.5A2.5 2.5 0 1 1 9.5 12 2.5 2.5 0 0 1 12 9.5Z" /></>,
  thermo: <><path d="M14 13.8V4a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0Z" /><path d="M12 8.5v6" /></>,
  peak: <><path d="M2 20h20" /><path d="m3.5 20 5.2-8 3 4 2.6-3.6L20.5 20" /></>,
  warn: <><path d="M12 3.5 1.8 20.5h20.4L12 3.5Z" /><path d="M12 9.5v4.5" /><path d="M12 17.2h.01" /></>,

  // ——— počasí ———
  sun: <><path d="M12 7.8A4.2 4.2 0 1 1 7.8 12 4.2 4.2 0 0 1 12 7.8Z" /><path d="M12 2.5v2.4M12 19.1v2.4M21.5 12h-2.4M4.9 12H2.5M18.7 5.3l-1.7 1.7M7 17l-1.7 1.7M18.7 18.7 17 17M7 7 5.3 5.3" /></>,
  cloud: <path d="M6.6 18.4h10.8a4 4 0 0 0 .4-8 5.6 5.6 0 0 0-10.8-.7 3.8 3.8 0 0 0-.4 8.7Z" />,
  cloudSun: <><path d="M9 5.2A3.4 3.4 0 1 1 5.6 8.6 3.4 3.4 0 0 1 9 5.2Z" /><path d="M7.5 19h9.6a3.6 3.6 0 0 0 .3-7.2 5 5 0 0 0-9.6-.6 3.4 3.4 0 0 0-.3 7.8Z" /></>,
  rain: <><path d="M6.6 16.4h10.8a4 4 0 0 0 .4-8 5.6 5.6 0 0 0-10.8-.7 3.8 3.8 0 0 0-.4 8.7Z" /><path d="M9 19v2.2M13 19v2.2" /></>,
  snow: <><path d="M6.6 16.4h10.8a4 4 0 0 0 .4-8 5.6 5.6 0 0 0-10.8-.7 3.8 3.8 0 0 0-.4 8.7Z" /><path d="M9 19.4v1.8M12.5 20.2v1.8M16 19.4v1.8" /></>,
  fog: <><path d="M6.6 14.4h10.8a4 4 0 0 0 .4-8 5.6 5.6 0 0 0-10.8-.7 3.8 3.8 0 0 0-.4 8.7Z" /><path d="M3.5 18h17M6.5 21h14" /></>,
  sunrise: <><path d="M12 3.5v4" /><path d="m8.8 6 3.2-2.5L15.2 6" /><path d="M2 17.5h20" /><path d="M7 17.5a5 5 0 0 1 10 0" /><path d="M5 21h14" /></>,
  sunset: <><path d="M12 7.5v-4" /><path d="M8.8 5 12 7.5 15.2 5" /><path d="M2 17.5h20" /><path d="M7 17.5a5 5 0 0 1 10 0" /><path d="M5 21h14" /></>,
}

export type IconName = keyof typeof PATHS

interface Props {
  name: IconName
  size?: number
  stroke?: number
  color?: string
  style?: React.CSSProperties
}

export function Icon({ name, size = 20, stroke = 1.75, color = 'currentColor', style }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="square"
      strokeLinejoin="miter"
      style={{ flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  )
}

/** Ikona počasí podle srážek, oblačnosti a dohlednosti. */
export function weatherIcon(precip: number, cloudCover: number, visibility: number | null, snow: boolean): IconName {
  if (visibility !== null && visibility < 1000) return 'fog'
  if (precip >= 0.1) return snow ? 'snow' : 'rain'
  if (cloudCover >= 75) return 'cloud'
  if (cloudCover >= 25) return 'cloudSun'
  return 'sun'
}
