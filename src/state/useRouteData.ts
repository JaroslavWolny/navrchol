import { useCallback, useEffect, useState } from 'react'
import { invalidate, loadRouteData, signatureOf } from './routeCache'
import { weekOutlook, type DayOutlook } from '../lib/plan'
import type { Forecast } from '../lib/openMeteo'
import type { Track } from '../lib/routing'
import type { Route } from '../lib/types'

export interface RouteData {
  track: Track | null
  forecast: Forecast | null
  loading: boolean
  error: string | null
  reload: () => void
}

export function useRouteData(route: Route | null): RouteData {
  const [bundle, setBundle] = useState<{ track: Track | null; forecast: Forecast | null }>({
    track: null,
    forecast: null,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  const reload = useCallback(() => {
    if (route) invalidate(route)
    setNonce((n) => n + 1)
  }, [route])

  const signature = route && route.waypoints.length > 0 ? signatureOf(route) : null

  useEffect(() => {
    if (!route || !signature) {
      setBundle({ track: null, forecast: null })
      setLoading(false)
      return
    }

    let alive = true
    setLoading(true)
    setError(null)

    loadRouteData(route)
      .then((b) => {
        if (alive) setBundle(b)
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : 'Data se nepodařilo stáhnout.')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [signature, nonce])

  return { ...bundle, loading, error, reload }
}

/**
 * Výhled pro všechny uložené trasy, aby seznam mohl ukázat skóre u každé.
 * Načítá se postupně jedna po druhé — na seznam se nikdo nedívá tak rychle,
 * aby mu vadilo, že poslední řádek dorazí o vteřinu později.
 */
export interface RouteOutlook {
  week: DayOutlook[]
  track: Track
}

export function useAllOutlooks(routes: Route[]): Record<string, RouteOutlook> {
  const [byRoute, setByRoute] = useState<Record<string, RouteOutlook>>({})
  const key = routes.map((r) => r.id + ':' + signatureOf(r)).join('|')

  useEffect(() => {
    let alive = true
    void (async () => {
      for (const route of routes) {
        if (!alive) return
        if (route.waypoints.length < 2) continue
        try {
          const { track, forecast } = await loadRouteData(route)
          if (!alive) return
          const week = weekOutlook(route, track, forecast)
          setByRoute((prev) => ({ ...prev, [route.id]: { week, track } }))
        } catch {
          // Jedna trasa, která se nenačte, nesmí zabít celý seznam.
        }
      }
    })()
    return () => {
      alive = false
    }
  }, [key])

  return byRoute
}
