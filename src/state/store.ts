import type { Route } from '../lib/types'

const KEY = 'navrchol.v1'

export interface BaseGearItem {
  id: string
  name: string
}

export interface StoredState {
  routes: Route[]
  activeRouteId: string | null
  baseGear: BaseGearItem[]
  /** ID trasy → názvy položek, které už jsou sbalené. */
  packed: Record<string, string[]>
  /** Úvod se ukazuje jen jednou, ale jde vyvolat znovu z „O appce". */
  seenIntro: boolean
}

export const DEFAULT_BASE_GEAR: BaseGearItem[] = [
  { id: 'voda', name: 'Voda 2 l' },
  { id: 'mapa', name: 'Offline mapa' },
  { id: 'lekarnicka', name: 'Lékárnička' },
  { id: 'svacina', name: 'Svačina' },
  { id: 'powerbanka', name: 'Powerbanka' },
  { id: 'nuz', name: 'Nůž' },
  { id: 'hotovost', name: 'Hotovost na chatu' },
]

export const DEMO_ROUTE_ID = 'demo-snezka'

/** Ukázková trasa, aby appka po instalaci hned něco ukázala. Jde smazat. */
export const DEMO_ROUTE: Route = {
  id: DEMO_ROUTE_ID,
  name: 'Sněžka z Pece',
  startTime: '07:00',
  pace: 'stredni',
  roundTrip: true,
  waypoints: [
    { id: 'w1', name: 'Pec pod Sněžkou', lat: 50.6903, lon: 15.7322, elevation: 769 },
    { id: 'w2', name: 'Růžová hora', lat: 50.7253, lon: 15.7397, elevation: 1390 },
    { id: 'w3', name: 'Sněžka', lat: 50.7361, lon: 15.7397, elevation: 1603 },
  ],
}

const EMPTY: StoredState = {
  routes: [DEMO_ROUTE],
  activeRouteId: DEMO_ROUTE.id,
  baseGear: DEFAULT_BASE_GEAR,
  packed: {},
  seenIntro: false,
}

/** localStorage umí selhat v anonymním okně i při zaplněné kvótě — nikdy kvůli tomu nespadnout. */
export function load(): StoredState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return EMPTY
    const parsed = JSON.parse(raw) as Partial<StoredState>
    return {
      routes: parsed.routes ?? EMPTY.routes,
      activeRouteId: parsed.activeRouteId ?? parsed.routes?.[0]?.id ?? null,
      baseGear: parsed.baseGear ?? DEFAULT_BASE_GEAR,
      packed: parsed.packed ?? {},
      seenIntro: parsed.seenIntro ?? false,
    }
  } catch {
    return EMPTY
  }
}

export function save(state: StoredState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // Neuložilo se. Appka běží dál, jen si to nezapamatuje.
  }
}

export const newId = (): string =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
