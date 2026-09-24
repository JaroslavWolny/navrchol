import L from 'leaflet'

/** Topografický podklad: vrstevnice, stínování, chaty i pěšiny. */
export function topoLayer(): L.TileLayer {
  return L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 17,
    subdomains: 'abc',
    attribution:
      '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>, SRTM · <a href="https://opentopomap.org">OpenTopoMap</a>',
  })
}

/**
 * Značené turistické trasy (KČT a všechny ostatní z OpenStreetMap) jako průhledná
 * vrstva nad mapou. Bez ní se v editoru špatně trefuje pěšina, po které se jde.
 */
export function trailsLayer(): L.TileLayer {
  return L.tileLayer('https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png', {
    maxZoom: 17,
    // Na malém měřítku je to jen spleť čar přes celou republiku.
    minZoom: 11,
    opacity: 0.75,
    attribution: '<a href="https://hiking.waymarkedtrails.org">Waymarked Trails</a>',
  })
}

/** Neutrální podklad pro radar — na topo mapě by se echo srážek ztratilo. */
export function canvasLayer(dark: boolean): L.TileLayer {
  const style = dark ? 'World_Dark_Gray_Base' : 'World_Light_Gray_Base'
  return L.tileLayer(`https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/${style}/MapServer/tile/{z}/{y}/{x}`, {
    maxZoom: 15,
    attribution: 'Podklad © Esri',
  })
}

export const prefersDark = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches === true

/** Barvy verdiktu pro Leaflet, který CSS proměnné v SVG cestách nezná. */
export function toneColors(): Record<'jdi' | 'zvaz' | 'nejdi', string> {
  const cs = getComputedStyle(document.documentElement)
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback
  return {
    jdi: v('--go', '#1d9a4e'),
    zvaz: v('--mid-fill', '#f2a100'),
    nejdi: v('--stop', '#d33228'),
  }
}

export function pinIcon(label: string, variant: 'num' | 'top' | 'dot' = 'num'): L.DivIcon {
  const size = variant === 'dot' ? 14 : 26
  const cls = variant === 'top' ? 'pin pin--top' : variant === 'dot' ? 'pin pin--small' : 'pin'
  return L.divIcon({
    className: '',
    html: `<div class="${cls}">${variant === 'dot' ? '' : label}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

/** Mapa bez reklamy na knihovnu v rohu; zdroje dat v atribuci zůstávají. */
export function createMap(el: HTMLElement, options: L.MapOptions = {}): L.Map {
  const m = L.map(el, { zoomControl: false, attributionControl: true, keyboard: false, ...options })
  m.attributionControl.setPrefix(false)
  return m
}
