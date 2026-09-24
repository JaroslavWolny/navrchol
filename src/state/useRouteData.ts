import { useCallback, useEffect, useMemo, useState } from 'react'
import { FRESH_MS, loadRouteData, readCached, signatureOf, type RouteBundle } from './routeCache'
import { weekOutlook, type DayOutlook, type PlannedRoute } from '../lib/plan'
import { isRateLimited, type Forecast } from '../lib/openMeteo'
import { withReturn, type Track } from '../lib/routing'
import type { Route } from '../lib/types'

export interface RouteData {
  /** Trať tak, jak se jde — u tam a zpět i s návratem. */
  track: Track | null
  /** Jednosměrná trať, jak přišla ze služby nebo z GPX. */
  oneWay: Track | null
  forecast: Forecast | null
  loading: boolean
  /** Nic se nenačetlo a není ani nic uloženého. */
  error: string | null
  /** Ukazuje se uložená předpověď, protože nová se nestáhla. */
  offline: string | null
  /** Kdy data dorazila ze sítě (ms). */
  fetchedAt: number | null
  reload: () => void
}

/** Krátká příčina, proč se nová předpověď nestáhla. */
const message = (e: unknown) =>
  isRateLimited(e)
    ? 'Služba předpovědi je přetížená, zkus to za minutu'
    : typeof navigator !== 'undefined' && navigator.onLine === false
      ? 'Jsi offline'
      : 'Nová předpověď se nestáhla'

export function useRouteData(route: Route | null): RouteData {
  // Podpis se drží u dat, ne vedle nich. Bez toho se při přepnutí trasy na jeden
  // render spáruje nová trasa se starou předpovědí.
  const [bundle, setBundle] = useState<{ signature: string; data: RouteBundle } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [offline, setOffline] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  const signature = route && route.waypoints.length > 1 ? signatureOf(route) : null
  const reload = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    if (!route || !signature) {
      setBundle(null)
      setLoading(false)
      setError(null)
      setOffline(null)
      return
    }

    let alive = true
    setLoading(true)
    setError(null)
    setOffline(null)

    void (async () => {
      // Nejdřív to, co je v telefonu — plán se ukáže hned, i bez signálu.
      const cached = await readCached(route)
      if (!alive) return
      if (cached) setBundle({ signature, data: cached })
      // Čerstvá uložená data se znovu nestahují, pokud o to člověk sám neřekl.
      if (cached && nonce === 0 && Date.now() - cached.forecast.fetchedAt < FRESH_MS) {
        setLoading(false)
        return
      }
      try {
        const data = await loadRouteData(route, nonce > 0)
        if (!alive) return
        setBundle({ signature, data })
      } catch (e) {
        if (!alive) return
        if (cached) setOffline(message(e))
        else setError(message(e))
      } finally {
        if (alive) setLoading(false)
      }
    })()

    return () => {
      alive = false
    }
    // Trasa se sleduje přes podpis; změna jména nebo startu nic nestahuje.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, nonce])

  // Dokud nedorazí data pro *tuhle* trasu, ven jde null — nikdy cizí předpověď.
  const data = bundle && bundle.signature === signature ? bundle.data : null

  // Telefon drží appku v paměti i přes noc. Po návratu se stará předpověď
  // obnoví sama, ne až když si člověk všimne času u „aktualizováno".
  const fetchedAt = data?.forecast.fetchedAt ?? null
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && fetchedAt !== null && Date.now() - fetchedAt > FRESH_MS) {
        reload()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [fetchedAt, reload])
  const roundTrip = route?.roundTrip === true
  // Trať s návratem musí mít stálou identitu: výpočty si k ní pamatují mezivýsledky.
  const track = useMemo(
    () => (data ? (roundTrip ? withReturn(data.track) : data.track) : null),
    [data, roundTrip],
  )

  return {
    track,
    oneWay: data?.track ?? null,
    forecast: data?.forecast ?? null,
    fetchedAt,
    loading: loading || (signature !== null && !data && error === null),
    error: data ? null : error,
    offline,
    reload,
  }
}

/**
 * Výhled pro všechny uložené trasy, aby seznam mohl ukázat nejlepší okno u každé.
 * Nejdřív z uložených dat, pak postupně ze sítě — jedna trasa po druhé, s pauzou.
 * Ansámbl má minutový limit a pět tras obnovených naráz ho vyčerpá; pak by se
 * nestáhla ani trasa, na kterou se člověk zrovna dívá. Seznam proto obnovuje
 * jen předpovědi starší než dvě hodiny — týdenní výhled se za tu dobu nezmění.
 */
const LIST_STALE_MS = 2 * 3_600_000
const LIST_GAP_MS = 4000

export interface RouteOutlook {
  week: DayOutlook[]
  track: Track
  fetchedAt: number
}

export function useAllOutlooks(routes: PlannedRoute[]): Record<string, RouteOutlook> {
  const [byRoute, setByRoute] = useState<Record<string, RouteOutlook>>({})
  const key = routes.map((r) => `${r.id}:${signatureOf(r)}:${r.roundTrip}:${r.pace}:${r.breakMin}:${r.paceScale}`).join('|')

  useEffect(() => {
    let alive = true
    const put = (route: PlannedRoute, data: RouteBundle) => {
      const track = route.roundTrip ? withReturn(data.track) : data.track
      const week = weekOutlook(route, track, data.forecast)
      setByRoute((prev) => ({ ...prev, [route.id]: { week, track, fetchedAt: data.forecast.fetchedAt } }))
    }

    void (async () => {
      const usable = routes.filter((r) => r.waypoints.length > 1)
      const stale: PlannedRoute[] = []
      for (const route of usable) {
        const cached = await readCached(route)
        if (!alive) return
        if (cached) put(route, cached)
        if (!cached || Date.now() - cached.forecast.fetchedAt > LIST_STALE_MS) stale.push(route)
      }
      for (const route of stale) {
        if (!alive || document.visibilityState === 'hidden') return
        try {
          put(route, await loadRouteData(route))
        } catch {
          // Jedna trasa, která se nenačte, nesmí zabít celý seznam.
        }
        await new Promise((r) => setTimeout(r, LIST_GAP_MS))
      }
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return byRoute
}
