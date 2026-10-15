import type { CSSProperties, JSX } from 'react'

/**
 * Lineární ikony na mřížce 24 × 24: kulaté konce a spoje, jedna tloušťka tahu,
 * barva z currentColor. Kresby podle návrhu v design/redesign-2026-10.
 */
const STROKE: Record<string, JSX.Element> = {
  // ——— záložky ———
  trasy: (
    <>
      <circle cx="6" cy="5.5" r="2.25" />
      <circle cx="18" cy="18.5" r="2.25" />
      <path d="M8.2 5.5h6.3a3.25 3.25 0 0 1 0 6.5h-5a3.25 3.25 0 0 0 0 6.5h6.3" />
    </>
  ),
  verdikt: <path d="M2.5 19.5 9 8.5l3.6 6 2.4-3.6 6.5 8.6zM9 8.5V3.5l3.2 1.3L9 6.1" />,
  kdy: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4M8 14.5h3" />
    </>
  ),
  slunce: <path d="M3 17.5h18M6.5 17.5a5.5 5.5 0 0 1 11 0M12 5v3M4.6 9.6l2 2M19.4 9.6l-2 2M8 21h8" />,
  vybava: (
    <>
      <path d="M6.5 9A5.5 5.5 0 0 1 17.5 9v10a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 19z" />
      <path d="M9.5 5.2V4.8a1.3 1.3 0 0 1 1.3-1.3h2.4a1.3 1.3 0 0 1 1.3 1.3v.4M9.5 14h5v3h-5z" />
    </>
  ),

  // ——— ovládání ———
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />,
  back: <path d="M15 6l-6 6 6 6" />,
  chevron: <path d="M9 6l6 6-6 6" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  edit: <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16zM13.5 6.5l4 4" />,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7" />,
  refresh: <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4" />,
  share: <path d="M12 15V3.5M8 7l4-3.5L16 7M5 12v6.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V12" />,
  more: <path d="M6 12h.01M12 12h.01M18 12h.01" strokeWidth="3.2" />,
  settings: (
    <>
      <path d="M10.3 3.8a1.7 1.7 0 0 1 3.4 0l.1.6a1.7 1.7 0 0 0 2.4 1l.6-.3a1.7 1.7 0 0 1 2.4 2.4l-.3.6a1.7 1.7 0 0 0 1 2.4l.6.1a1.7 1.7 0 0 1 0 3.4l-.6.1a1.7 1.7 0 0 0-1 2.4l.3.6a1.7 1.7 0 0 1-2.4 2.4l-.6-.3a1.7 1.7 0 0 0-2.4 1l-.1.6a1.7 1.7 0 0 1-3.4 0l-.1-.6a1.7 1.7 0 0 0-2.4-1l-.6.3a1.7 1.7 0 0 1-2.4-2.4l.3-.6a1.7 1.7 0 0 0-1-2.4l-.6-.1a1.7 1.7 0 0 1 0-3.4l.6-.1a1.7 1.7 0 0 0 1-2.4l-.3-.6a1.7 1.7 0 0 1 2.4-2.4l.6.3a1.7 1.7 0 0 0 2.4-1Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  locate: <path d="M20 4 3.5 10.5l7 3 3 7z" />,
  search: <path d="M11 17.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM16 16l4.5 4.5" />,
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.8h.01" />
    </>
  ),
  file: <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M12 11v6M9 14l3 3 3-3" />,
  arrowUp: <path d="M12 19V5M6 11l6-6 6 6" />,
  arrowDown: <path d="M12 5v14M18 13l-6 6-6-6" />,
  swap: <path d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4" />,
  sliders: (
    <>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </>
  ),
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  asterisk: <path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9" />,
  layers: <path d="m12 3.5 8.5 4.5-8.5 4.5L3.5 8Zm-8.5 8.2 8.5 4.5 8.5-4.5M3.5 15.7l8.5 4.5 8.5-4.5" />,

  // ——— veličiny ———
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  pause: <path d="M5 10h11v4a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 11h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5v3M11 3.5v3" />,
  walk: (
    <>
      <circle cx="13" cy="4.5" r="1.8" />
      <path d="M10 21l2-6 3 3v3M8 12l3-4 3 2 3 1M12 8l-1 5" />
    </>
  ),
  wind: <path d="M3 8h10a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7" />,
  drop: <path d="M12 3.5s6 6.4 6 10.5a6 6 0 0 1-12 0c0-4.1 6-10.5 6-10.5z" />,
  thermo: <path d="M10 14.5V5a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0z" />,
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  warn: <path d="M10.3 4.6 2.9 17.4a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.6a2 2 0 0 0-3.4 0ZM12 9.5v4M12 16.8h.01" />,
  bolt: <path d="M13 3 5.5 13.5H12L11 21l7.5-10.5H12Z" />,
  mountain: <path d="M2.8 19.2 8.9 8.6a.8.8 0 0 1 1.4 0l3.4 5.9 2-3.1a.8.8 0 0 1 1.3 0l4.4 7.8Z" />,
  flag: <path d="M5.5 21V4M5.5 4.5h11l-2.4 4 2.4 4h-11" />,
  ground: <path d="M8 4s3 3.2 3 5.2a3 3 0 0 1-6 0C5 7.2 8 4 8 4zM16 9s3 3.2 3 5.2a3 3 0 0 1-6 0c0-2 3-5.2 3-5.2zM3 21h18" />,
  snowflake: <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5" />,
  gauge: <path d="M4.2 17.5a8.5 8.5 0 1 1 15.6 0M12 13.5l3.5-4" />,
  radar: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 12l6-6" />
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
  sunrise: <path d="M3 18h18M6.5 18a5.5 5.5 0 0 1 11 0M12 9V3M9 6l3-3 3 3" />,
  sunset: <path d="M3 18h18M6.5 18a5.5 5.5 0 0 1 11 0M12 3v6M9 6l3 3 3-3" />,
}

export type IconName = keyof typeof STROKE

interface Props {
  name: IconName
  size?: number
  stroke?: number
  color?: string
  style?: CSSProperties
  className?: string
  title?: string
}

export function Icon({ name, size = 22, stroke = 1.8, color = 'currentColor', style, className, title }: Props) {
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
      {STROKE[name]}
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
