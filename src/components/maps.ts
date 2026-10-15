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
export function canvasLayer(): L.TileLayer {
  return L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 15,
    attribution: 'Podklad © Esri',
  })
}

/** Barvy verdiktu pro Leaflet, který CSS proměnné v SVG cestách nezná. */
export function toneColors(): Record<'jdi' | 'zvaz' | 'nejdi', string> {
  const cs = getComputedStyle(document.documentElement)
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback
  return {
    jdi: v('--go', '#c8f169'),
    zvaz: v('--warn', '#ffc74a'),
    nejdi: v('--stop', '#ff6b4e'),
  }
}

/**
 * Kresba trasy: světlý lem, černá čára a uvnitř barevné jádro. Jádro je
 * limetkové, nebo po úsecích v barvě verdiktu.
 */
export const LINE = { halo: '#e3e7df', ink: '#0e1210', haloWeight: 10, inkWeight: 6, coreWeight: 2.5 } as const

/**
 * Značky: start černé kolečko, poslední bod limetkový čtverec, body mezi nimi
 * světlé kolečko, vrchol černý trojúhelník, průchozí bod malá tečka.
 */
export function pinIcon(label: string, variant: 'num' | 'end' | 'mid' | 'top' | 'dot' = 'num'): L.DivIcon {
  if (variant === 'top') {
    return L.divIcon({
      className: '',
      html: '<svg class="pin pin--top" width="22" height="20" viewBox="0 0 22 20"><path d="M11 1.5 20.5 18.5h-19Z" fill="#0e1210" stroke="#e3e7df" stroke-width="2" stroke-linejoin="round"/></svg>',
      iconSize: [22, 20],
      iconAnchor: [11, 13],
    })
  }
  const size = variant === 'dot' ? 14 : 32
  const cls = variant === 'end' ? 'pin pin--end' : variant === 'mid' ? 'pin pin--mid' : variant === 'dot' ? 'pin pin--small' : 'pin'
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
