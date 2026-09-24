import type { CSSProperties, JSX } from 'react'

/**
 * Vlastní sada na mřížce 24 × 24, kreslená v duchu systémových ikon iOS:
 * kulaté konce a spoje, jedna tloušťka tahu. Záložky mají i plnou variantu —
 * aktivní záložka je na iOS plná, ne jen jinak barevná.
 */
const STROKE: Record<string, JSX.Element> = {
  // ——— záložky ———
  trasy: (
    <>
      <circle cx="6" cy="6" r="2.4" />
      <circle cx="18" cy="18" r="2.4" />
      <path d="M6 8.4v3.1A3.5 3.5 0 0 0 9.5 15h5a3.5 3.5 0 0 1 3.5 3.5" strokeDasharray="0.1 3.2" />
    </>
  ),
  verdikt: <path d="M2.8 19.2 8.9 8.6a.8.8 0 0 1 1.4 0l3.4 5.9 2-3.1a.8.8 0 0 1 1.3 0l4.4 7.8Z" />,
  kdy: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3.2" />
      <path d="M3.5 9.8h17M8 3v3.6M16 3v3.6" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 17.2h.01M12 17.2h.01" strokeWidth="2.6" />
    </>
  ),
  slunce: (
    <>
      <path d="M2.8 18h18.4M6.8 18a5.2 5.2 0 0 1 10.4 0" />
      <path d="M12 5.2v2.3M4.9 9.3l1.6 1.6M19.1 9.3l-1.6 1.6M5.5 21h13" />
    </>
  ),
  vybava: (
    <>
      <path d="M7 10.2a5 5 0 0 1 10 0V19a1.8 1.8 0 0 1-1.8 1.8H8.8A1.8 1.8 0 0 1 7 19Z" />
      <path d="M10 5.6V4.8a2 2 0 0 1 4 0v.8M9.8 20.8v-3.7c0-.6.5-1.1 1.1-1.1h2.2c.6 0 1.1.5 1.1 1.1v3.7M7 12.2H5.8c-.7 0-1.3.6-1.3 1.3v3.2c0 .7.6 1.3 1.3 1.3H7M17 12.2h1.2c.7 0 1.3.6 1.3 1.3v3.2c0 .7-.6 1.3-1.3 1.3H17M9.8 11h4.4" />
    </>
  ),

  // ——— ovládání ———
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />,
  back: <path d="m14.8 5-7 7 7 7" />,
  chevron: <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />,
  chevronDown: <path d="m6 9.5 6 6 6-6" />,
  check: <path d="m5 12.6 4.4 4.4L19 7.4" />,
  edit: <path d="M4.5 19.5h4L19 9a2.8 2.8 0 0 0-4-4L4.5 15.5Zm9-13 4 4" />,
  trash: <path d="M4.5 6.5h15M10 3.5h4M6.5 6.5l.8 12.2a2 2 0 0 0 2 1.8h5.4a2 2 0 0 0 2-1.8l.8-12.2M10 10.5v6M14 10.5v6" />,
  refresh: <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4v4h-4" />,
  share: <path d="M12 14.5V3.5M8 7l4-4 4 4M7.5 10.5H6.4a1.9 1.9 0 0 0-1.9 1.9v6.2a1.9 1.9 0 0 0 1.9 1.9h11.2a1.9 1.9 0 0 0 1.9-1.9v-6.2a1.9 1.9 0 0 0-1.9-1.9h-1.1" />,
  more: <path d="M6 12h.01M12 12h.01M18 12h.01" strokeWidth="3.2" />,
  settings: (
    <>
      <path d="M10.3 3.8a1.7 1.7 0 0 1 3.4 0l.1.6a1.7 1.7 0 0 0 2.4 1l.6-.3a1.7 1.7 0 0 1 2.4 2.4l-.3.6a1.7 1.7 0 0 0 1 2.4l.6.1a1.7 1.7 0 0 1 0 3.4l-.6.1a1.7 1.7 0 0 0-1 2.4l.3.6a1.7 1.7 0 0 1-2.4 2.4l-.6-.3a1.7 1.7 0 0 0-2.4 1l-.1.6a1.7 1.7 0 0 1-3.4 0l-.1-.6a1.7 1.7 0 0 0-2.4-1l-.6.3a1.7 1.7 0 0 1-2.4-2.4l.3-.6a1.7 1.7 0 0 0-1-2.4l-.6-.1a1.7 1.7 0 0 1 0-3.4l.6-.1a1.7 1.7 0 0 0 1-2.4l-.3-.6a1.7 1.7 0 0 1 2.4-2.4l.6.3a1.7 1.7 0 0 0 2.4-1Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  locate: <path d="M20 4 4.5 10.6a.5.5 0 0 0 .1.9l6.2 1.7 1.7 6.2a.5.5 0 0 0 .9.1Z" />,
  search: <path d="M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM15.3 15.3 20 20" />,
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.8h.01" />
    </>
  ),
  file: <path d="M13.5 3.5H7.8a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h8.4a2 2 0 0 0 2-2V8.2Zm0 0v4.7h4.7M12 11v6M9.2 14.2 12 17l2.8-2.8" />,
  arrowUp: <path d="M12 19V5M6 11l6-6 6 6" />,
  arrowDown: <path d="M12 5v14M18 13l-6 6-6-6" />,
  swap: <path d="M7 4v16M3.5 16.5 7 20l3.5-3.5M17 20V4M13.5 7.5 17 4l3.5 3.5" />,
  layers: <path d="m12 3.5 8.5 4.5-8.5 4.5L3.5 8Zm-8.5 8.2 8.5 4.5 8.5-4.5M3.5 15.7l8.5 4.5 8.5-4.5" />,

  // ——— veličiny ———
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  pause: <path d="M5 10h11v3.5a5.5 5.5 0 0 1-11 0ZM16 11h1a2.5 2.5 0 0 1 0 5h-1.4M8 3.5v3M11.5 3.5v3" />,
  walk: (
    <>
      <circle cx="13" cy="4.5" r="1.8" />
      <path d="m9.5 21 2.2-6.3L14.5 17v4M11.7 14.7l.9-5.4M12.6 9.3 9.3 10.9 8 14M12.6 9.3l2.2 2.9 3 .9" />
    </>
  ),
  wind: <path d="M3.5 9h10a2.8 2.8 0 1 0-2.8-2.8M3.5 13h14.3a2.8 2.8 0 1 1-2.8 2.8M3.5 17h7" />,
  drop: <path d="M12 3.6c-3 4.2-5.6 7.4-5.6 10.4a5.6 5.6 0 0 0 11.2 0c0-3-2.6-6.2-5.6-10.4Z" />,
  thermo: <path d="M14 13.8V5.5a2 2 0 1 0-4 0v8.3a4 4 0 1 0 4 0ZM12 9v7" />,
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  warn: <path d="M10.3 4.6 2.9 17.4a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.6a2 2 0 0 0-3.4 0ZM12 9.5v4M12 16.8h.01" />,
  bolt: <path d="M13 3 5.5 13.5H12L11 21l7.5-10.5H12Z" />,
  mountain: <path d="M2.8 19.2 8.9 8.6a.8.8 0 0 1 1.4 0l3.4 5.9 2-3.1a.8.8 0 0 1 1.3 0l4.4 7.8Z" />,
  flag: <path d="M5.5 21V4M5.5 4.5h11l-2.4 4 2.4 4h-11" />,
  ground: <path d="M3 17c2-1.2 3.5-1.2 5.5 0s3.5 1.2 5.5 0 3.5-1.2 5.5 0M3 13c2-1.2 3.5-1.2 5.5 0s3.5 1.2 5.5 0 3.5-1.2 5.5 0M12 3.8c-1.6 2.3-2.8 3.8-2.8 5.3a2.8 2.8 0 0 0 5.6 0c0-1.5-1.2-3-2.8-5.3Z" />,
  snowflake: <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5" />,
  gauge: <path d="M4.2 17.5a8.5 8.5 0 1 1 15.6 0M12 13.5l3.5-4" />,
  radar: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 12 18 6M12 7.5A4.5 4.5 0 1 0 16.5 12" />
    </>
  ),
  moon: <path d="M19.5 14.6A7.8 7.8 0 0 1 9.4 4.5a7.8 7.8 0 1 0 10.1 10.1Z" />,
  sparkles: <path d="M11 3.5 12.6 8l4.4 1.5-4.4 1.6L11 15.5l-1.6-4.4L5 9.5 9.4 8ZM18 14l.8 2.2 2.2.8-2.2.8L18 20l-.8-2.2-2.2-.8 2.2-.8Z" />,

  // ——— počasí ———
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.8v2M12 19.2v2M21.2 12h-2M4.8 12h-2M18.5 5.5l-1.4 1.4M6.9 17.1l-1.4 1.4M18.5 18.5l-1.4-1.4M6.9 6.9 5.5 5.5" />
    </>
  ),
  cloud: <path d="M7 18.5h10.3a4 4 0 0 0 .3-8 5.6 5.6 0 0 0-10.9-.3A4.2 4.2 0 0 0 7 18.5Z" />,
  cloudSun: (
    <>
      <path d="M8.2 11.7a3.6 3.6 0 1 1 6.6-2.9M9.5 2.8v1.4M3.2 6.8l1 1M2.8 12h1.4M14.8 4.2l1-1" />
      <path d="M8.5 20.5h8.8a3.4 3.4 0 0 0 .3-6.8 4.8 4.8 0 0 0-9.3-.3 3.6 3.6 0 0 0 .2 7.1Z" />
    </>
  ),
  rain: (
    <>
      <path d="M7 15.5h10.3a4 4 0 0 0 .3-8 5.6 5.6 0 0 0-10.9-.3A4.2 4.2 0 0 0 7 15.5Z" />
      <path d="M8.5 18.5l-1 2M12.5 18.5l-1 2M16.5 18.5l-1 2" />
    </>
  ),
  snow: (
    <>
      <path d="M7 15.5h10.3a4 4 0 0 0 .3-8 5.6 5.6 0 0 0-10.9-.3A4.2 4.2 0 0 0 7 15.5Z" />
      <path d="M8.5 19h.01M12 20.5h.01M15.5 19h.01" strokeWidth="2.6" />
    </>
  ),
  fog: (
    <>
      <path d="M7 13.5h10.3a4 4 0 0 0 .3-8 5.6 5.6 0 0 0-10.9-.3A4.2 4.2 0 0 0 7 13.5Z" />
      <path d="M4 17h16M7 20.5h10" />
    </>
  ),
  storm: (
    <>
      <path d="M7 15.5h1M16 15.5h1.3a4 4 0 0 0 .3-8 5.6 5.6 0 0 0-10.9-.3A4.2 4.2 0 0 0 7 15.5" />
      <path d="m12.5 12.5-2 4h3l-2 4" />
    </>
  ),
  sunrise: (
    <>
      <path d="M2.8 18h18.4M6.8 18a5.2 5.2 0 0 1 10.4 0" />
      <path d="M12 4v5M9.5 6.5 12 4l2.5 2.5M5.5 21h13" />
    </>
  ),
  sunset: (
    <>
      <path d="M2.8 18h18.4M6.8 18a5.2 5.2 0 0 1 10.4 0" />
      <path d="M12 9V4M9.5 6.5 12 9l2.5-2.5M5.5 21h13" />
    </>
  ),
}

/** Plné varianty — aktivní záložka a zdůrazněné ikony. */
const FILLED: Record<string, JSX.Element> = {
  trasy: (
    <>
      <circle cx="6" cy="6" r="3" fill="currentColor" stroke="none" />
      <circle cx="18" cy="18" r="3" fill="currentColor" stroke="none" />
      <path d="M6 8.4v3.1A3.5 3.5 0 0 0 9.5 15h5a3.5 3.5 0 0 1 3.5 3.5" strokeDasharray="0.1 3.2" strokeWidth="2.4" />
    </>
  ),
  verdikt: (
    <path
      d="M2.8 19.2 8.9 8.6a.8.8 0 0 1 1.4 0l3.4 5.9 2-3.1a.8.8 0 0 1 1.3 0l4.4 7.8Z"
      fill="currentColor"
    />
  ),
  kdy: (
    <>
      <path d="M6.7 5h10.6a3.2 3.2 0 0 1 3.2 3.2v1.6h-17V8.2A3.2 3.2 0 0 1 6.7 5Z" fill="currentColor" />
      <rect x="3.5" y="5" width="17" height="15.5" rx="3.2" />
      <path d="M8 3v3.6M16 3v3.6" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 17.2h.01M12 17.2h.01" strokeWidth="2.8" />
    </>
  ),
  slunce: (
    <>
      <path d="M6.8 18a5.2 5.2 0 0 1 10.4 0Z" fill="currentColor" />
      <path d="M2.8 18h18.4M12 5.2v2.3M4.9 9.3l1.6 1.6M19.1 9.3l-1.6 1.6M5.5 21h13" />
    </>
  ),
  vybava: (
    <>
      <path d="M7 10.2a5 5 0 0 1 10 0V19a1.8 1.8 0 0 1-1.8 1.8H8.8A1.8 1.8 0 0 1 7 19Z" fill="currentColor" />
      <path d="M10 5.6V4.8a2 2 0 0 1 4 0v.8M7 12.2H5.8c-.7 0-1.3.6-1.3 1.3v3.2c0 .7.6 1.3 1.3 1.3H7M17 12.2h1.2c.7 0 1.3.6 1.3 1.3v3.2c0 .7-.6 1.3-1.3 1.3H17" />
      <path d="M9.8 20.8v-3.7c0-.6.5-1.1 1.1-1.1h2.2c.6 0 1.1.5 1.1 1.1v3.7M9.8 11h4.4" stroke="var(--icon-cut, #fff)" />
    </>
  ),
}

export type IconName = keyof typeof STROKE

interface Props {
  name: IconName
  size?: number
  stroke?: number
  filled?: boolean
  color?: string
  style?: CSSProperties
  className?: string
  title?: string
}

export function Icon({ name, size = 22, stroke = 1.8, filled = false, color = 'currentColor', style, className, title }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title && <title>{title}</title>}
      {(filled && FILLED[name]) || STROKE[name]}
    </svg>
  )
}

/** Ikona počasí podle srážek, oblačnosti, dohlednosti a bouřkové energie. */
export function weatherIcon(hour: {
  precipitationRisk: number
  precipitation: number
  cloudCover: number
  visibility: number | null
  snowfallRisk: number
  capeRisk: number
}): IconName {
  if (hour.capeRisk >= 800 && hour.precipitationRisk >= 0.5) return 'storm'
  if (hour.visibility !== null && hour.visibility < 1000) return 'fog'
  const wet = Math.max(hour.precipitation, hour.precipitationRisk * 0.6)
  if (wet >= 0.2) return hour.snowfallRisk > 0.1 ? 'snow' : 'rain'
  if (hour.cloudCover >= 75) return 'cloud'
  if (hour.cloudCover >= 25) return 'cloudSun'
  return 'sun'
}

/** Barva ikony počasí — slunce žluté, srážky azurové, oblačno šedé. */
export function weatherColor(icon: IconName): string {
  if (icon === 'sun') return 'var(--sun)'
  if (icon === 'cloudSun') return 'var(--sun)'
  if (icon === 'rain' || icon === 'storm') return 'var(--rain)'
  if (icon === 'snow') return 'var(--cold)'
  return 'var(--ink-3)'
}
