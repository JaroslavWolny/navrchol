import { isLoop } from '../lib/geo'
import { DEFAULT_PREFS, type Preferences } from '../lib/score'
import type { Route } from '../lib/types'

const KEY = 'navrchol.v1'

export interface BaseGearItem {
  id: string
  name: string
}

export interface Settings {
  /**
   * Osobní kalibrace tempa, 1 = průměrný turista podle Toblerovy funkce.
   * Spočítá se z túry, kterou člověk opravdu ušel.
   */
  paceScale: number
  /** Kdy a z jaké túry se tempo naposledy kalibrovalo. */
  calibratedFrom?: { routeName: string; at: number }
  /** Co komu vadí — mění body za pohodlí a případně vypíná tvrdé zákazy. */
  prefs: Preferences
}

export interface StoredState {
  routes: Route[]
  activeRouteId: string | null
  baseGear: BaseGearItem[]
  /** ID trasy → názvy položek, které už jsou sbalené. */
  packed: Record<string, string[]>
  /** Úvod se ukazuje jen jednou, ale jde vyvolat znovu z nastavení. */
  seenIntro: boolean
  settings: Settings
}

export const DEFAULT_BASE_GEAR: BaseGearItem[] = [
  { id: 'voda', name: 'Voda 1,5 l' },
  { id: 'mapa', name: 'Offline mapa v telefonu' },
  { id: 'lekarnicka', name: 'Lékárnička' },
  { id: 'svacina', name: 'Svačina' },
  { id: 'vrstva', name: 'Teplá vrstva navíc' },
  { id: 'powerbanka', name: 'Powerbanka' },
  { id: 'hotovost', name: 'Hotovost na chatu' },
]

export const DEMO_ROUTE_ID = 'demo-snezka'

/** Ukázková trasa, aby appka po instalaci hned něco ukázala. Jde smazat. */
export const DEMO_ROUTE: Route = {
  id: DEMO_ROUTE_ID,
  name: 'Sněžka z Pece',
  startTime: '07:30',
  pace: 'stredni',
  roundTrip: true,
  breakMin: 20,
  waypoints: [
    { id: 'w1', name: 'Pec pod Sněžkou', lat: 50.695, lon: 15.7392, elevation: 762 },
    { id: 'w2', name: 'Růžohorky', lat: 50.7104, lon: 15.7499, elevation: 1250 },
    { id: 'w3', name: 'Sněžka', lat: 50.7361, lon: 15.7397, elevation: 1603 },
  ],
}

const EMPTY: StoredState = {
  routes: [DEMO_ROUTE],
  activeRouteId: DEMO_ROUTE.id,
  baseGear: DEFAULT_BASE_GEAR,
  packed: {},
  seenIntro: false,
  settings: { paceScale: 1, prefs: DEFAULT_PREFS },
}

/**
 * Ukázková trasa se uložila dřív, než appka uměla návrat a pauzu, a start ležel
 * na svahu nad Pecí — trať pak nejdřív devadesát metrů klesala. Uživatelských
 * úprav ukázky (jméno, čas, tempo) se oprava nedotkne.
 */
function upgradeDemo(route: Route): Route {
  if (route.id !== DEMO_ROUTE_ID) return route
  const oldStart = route.waypoints[0]?.lat === 50.6903 && route.waypoints[0]?.lon === 15.7322
  return {
    ...route,
    roundTrip: route.roundTrip ?? true,
    breakMin: route.breakMin ?? DEMO_ROUTE.breakMin,
    waypoints: oldStart ? DEMO_ROUTE.waypoints : route.waypoints,
  }
}

/** localStorage umí selhat v anonymním okně i při zaplněné kvótě — nikdy kvůli tomu nespadnout. */
export function load(): StoredState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return EMPTY
    const parsed = JSON.parse(raw) as Partial<StoredState>
    return {
      // Okruh uložený se zapnutým tam a zpět by se šel dvakrát — nová trasa měla
      // přepínač zapnutý už od začátku.
      routes: (parsed.routes ?? EMPTY.routes)
        .map(upgradeDemo)
        .map((r) => (isLoop(r.waypoints) ? { ...r, roundTrip: false } : r)),
      activeRouteId: parsed.activeRouteId ?? parsed.routes?.[0]?.id ?? null,
      baseGear: parsed.baseGear ?? DEFAULT_BASE_GEAR,
      packed: parsed.packed ?? {},
      seenIntro: parsed.seenIntro ?? false,
      settings: {
        paceScale: 1,
        ...parsed.settings,
        // Jev, který přibude v nové verzi, má u starého nastavení zůstat „běžně".
        prefs: {
          comfort: { ...DEFAULT_PREFS.comfort, ...parsed.settings?.prefs?.comfort },
          bansOff: parsed.settings?.prefs?.bansOff ?? [],
        },
      },
    }
  } catch {
    return EMPTY
  }
}

export function save(state: StoredState): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
    return true
  } catch {
    // Neuložilo se. Appka běží dál, jen si to nezapamatuje.
    return false
  }
}

export const newId = (): string =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
