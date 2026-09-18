import type { JSX } from 'react'

const PATHS: Record<string, JSX.Element> = {
  trasy: <><path d="M9 4 3 6.5v14L9 18l6 2.5 6-2.5v-14L15 6.5 9 4z" /><path d="M9 4v14" /><path d="M15 6.5v14" /></>,
  verdikt: <><path d="m2 19 6.4-9.6 3.6 4.6 3.2-4.4L22 19H2z" /><circle cx="17.5" cy="5.5" r="2.5" /></>,
  kdy: <><rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M3 10h18" /><path d="M8 3v4" /><path d="M16 3v4" /></>,
  slunce: <><path d="M12 3v3.4" /><path d="M5.5 8.5 7.9 10.9" /><path d="M18.5 8.5 16.1 10.9" /><path d="M2.5 17.5h19" /><path d="M6.8 17.5a5.2 5.2 0 0 1 10.4 0" /><path d="M9.2 20.8h5.6" /></>,
  vybava: <><path d="M6 8h12a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-7a3 3 0 0 1 3-3z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /><path d="M9 13h6" /></>,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  back: <path d="M15 5l-7 7 7 7" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  wind: <><path d="M3 8h11a3 3 0 1 0-3-3" /><path d="M3 13h15a3 3 0 1 1-3 3" /><path d="M3 18h8" /></>,
  drop: <path d="M12 2.7S5.5 9.9 5.5 14.2a6.5 6.5 0 0 0 13 0C18.5 9.9 12 2.7 12 2.7z" />,
  eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="2.6" /></>,
  thermo: <path d="M14 4v10.5a4 4 0 1 1-4 0V4a2 2 0 1 1 4 0z" />,
  warn: <><path d="M10.3 3.9 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4" /><path d="M12 17h.01" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  sunrise: <><path d="M12 4v3M5.9 9.1 8 11.2M18.1 9.1 16 11.2M3 17h18M7.2 17a4.8 4.8 0 0 1 9.6 0" /></>,
  sunset: <><path d="M12 11V4M8.8 7.5 12 11l3.2-3.5M3 17h18M7.2 17a4.8 4.8 0 0 1 9.6 0" /></>,
  sun: <><circle cx="12" cy="12" r="4.2" /><path d="M12 2.6v2.2M12 19.2v2.2M21.4 12h-2.2M4.8 12H2.6M18.6 5.4l-1.6 1.6M7 17l-1.6 1.6M18.6 18.6 17 17M7 7 5.4 5.4" /></>,
  cloud: <path d="M6.6 18.4h10.8a4 4 0 0 0 .4-8 5.6 5.6 0 0 0-10.8-.7 3.8 3.8 0 0 0-.4 8.7z" />,
  cloudSun: <><circle cx="9" cy="8.4" r="3.4" /><path d="M7.5 19h9.6a3.6 3.6 0 0 0 .3-7.2 5 5 0 0 0-9.6-.6 3.4 3.4 0 0 0-.3 7.8z" /></>,
  rain: <><path d="M6.6 16.4h10.8a4 4 0 0 0 .4-8 5.6 5.6 0 0 0-10.8-.7 3.8 3.8 0 0 0-.4 8.7z" /><path d="M9 19.4l-.8 2M13 19.4l-.8 2" /></>,
  snow: <><path d="M6.6 16.4h10.8a4 4 0 0 0 .4-8 5.6 5.6 0 0 0-10.8-.7 3.8 3.8 0 0 0-.4 8.7z" /><path d="M9 20h.01M12.5 21h.01M16 20h.01" /></>,
  fog: <><path d="M6.6 14.4h10.8a4 4 0 0 0 .4-8 5.6 5.6 0 0 0-10.8-.7 3.8 3.8 0 0 0-.4 8.7z" /><path d="M4 18h16M7 21h13" /></>,
  arrowUp: <><path d="M12 19V5" /><path d="M6 11l6-6 6 6" /></>,
  refresh: <><path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1" /><path d="M20.8 4.5v5h-5" /></>,
  trash: <><path d="M4 7h16" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /><path d="M6.5 7l1 13h9l1-13" /></>,
  locate: <><circle cx="12" cy="12" r="7" /><path d="M12 2v3M12 19v3M22 12h-3M5 12H2" /></>,
  edit: <><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z" /><path d="M13.5 6.5l4 4" /></>,
  peak: <path d="m2 19 6.4-9.6 3.6 4.6 3.2-4.4L22 19H2z" />,
}

export type IconName = keyof typeof PATHS

interface Props {
  name: IconName
  size?: number
  stroke?: number
  color?: string
  style?: React.CSSProperties
}

export function Icon({ name, size = 20, stroke = 1.8, color = 'currentColor', style }: Props) {
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
      style={{ flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  )
}

/** Ikona počasí podle WMO kódu a oblačnosti. */
export function weatherIcon(precip: number, cloudCover: number, visibility: number | null, snow: boolean): IconName {
  if (visibility !== null && visibility < 1000) return 'fog'
  if (precip >= 0.1) return snow ? 'snow' : 'rain'
  if (cloudCover >= 75) return 'cloud'
  if (cloudCover >= 25) return 'cloudSun'
  return 'sun'
}
