import { useCallback, useEffect, useMemo, useState } from 'react'
import { flushSync } from 'react-dom'
import { TabBar, type Tab } from './components/TabBar'
import { EditorScreen } from './screens/Editor'
import { KdyJitScreen } from './screens/KdyJit'
import { SlunceScreen } from './screens/Slunce'
import { TrasyScreen } from './screens/Trasy'
import { VerdiktScreen } from './screens/Verdikt'
import { VybavaScreen } from './screens/Vybava'
import { UvodScreen } from './screens/Uvod'
import { NastaveniScreen } from './screens/Nastaveni'
import { assess, weekOutlook, type PlannedRoute } from './lib/plan'
import { DEMO_ROUTE, load, newId, save, type StoredState } from './state/store'
import { pruneBundles } from './state/persist'
import { storeKeyOf } from './state/routeCache'
import { useRouteData } from './state/useRouteData'
import type { Route } from './lib/types'

type View = 'tabs' | 'editor' | 'settings'

/** Nejbližší výskyt času startu — dnes, pokud ještě nebyl, jinak zítra. */
function defaultStart(route: Route | null): Date {
  const now = new Date()
  const [h, m] = (route?.startTime ?? '07:30').split(':').map(Number)
  const d = new Date(now)
  d.setHours(h, m ?? 0, 0, 0)
  if (d <= now) d.setDate(d.getDate() + 1)
  return d
}

/**
 * Přechod mezi obrazovkami jako na iOS: podřízená obrazovka přijede zprava,
 * zpátky odjede doprava. Kde prohlížeč View Transitions neumí, prostě se
 * přepne.
 */
function navigate(update: () => void, direction: 'push' | 'pop' | 'none' = 'none') {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown }
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (!doc.startViewTransition || reduced || direction === 'none') {
    update()
    return
  }
  document.documentElement.dataset.nav = direction
  doc.startViewTransition(() => flushSync(update))
}

export default function App() {
  const [state, setState] = useState<StoredState>(load)
  const [tab, setTab] = useState<Tab>('verdikt')
  const [view, setView] = useState<View>('tabs')
  const [editing, setEditing] = useState<Route | null>(null)

  useEffect(() => {
    save(state)
  }, [state])

  // Data smazaných tras se v telefonu neschovávají věčně.
  const routeKeys = state.routes.map(storeKeyOf).join('|')
  useEffect(() => {
    const t = setTimeout(() => void pruneBundles(new Set(state.routes.map(storeKeyOf))), 4000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKeys])

  const route = state.routes.find((r) => r.id === state.activeRouteId) ?? null
  const planned: PlannedRoute | null = useMemo(
    () => (route ? { ...route, paceScale: state.settings.paceScale } : null),
    [route, state.settings.paceScale],
  )
  const data = useRouteData(route)

  const [start, setStart] = useState<Date>(() => defaultStart(route))
  useEffect(() => setStart(defaultStart(route)), [route?.id, route?.startTime])

  const assessment = useMemo(() => {
    if (!planned || !data.track || !data.forecast) return null
    return assess(planned, data.track, data.forecast, start)
  }, [planned, data.track, data.forecast, start])

  const week = useMemo(() => {
    if (!planned || !data.track || !data.forecast) return null
    return weekOutlook(planned, data.track, data.forecast)
  }, [planned, data.track, data.forecast])

  const setRoutes = useCallback(
    (fn: (routes: Route[]) => Route[], activeId?: string | null) =>
      setState((s) => {
        const routes = fn(s.routes)
        const active = activeId !== undefined ? activeId : s.activeRouteId
        return {
          ...s,
          routes,
          activeRouteId: routes.some((r) => r.id === active) ? active : (routes[0]?.id ?? null),
        }
      }),
    [],
  )

  const deleteRoute = (id: string) => setRoutes((routes) => routes.filter((r) => r.id !== id))

  const saveRoute = (next: Route) =>
    setRoutes(
      (routes) => (routes.some((r) => r.id === next.id) ? routes.map((r) => (r.id === next.id ? next : r)) : [...routes, next]),
      next.id,
    )

  const openEditor = (r: Route | null) =>
    navigate(() => {
      setEditing(
        r ?? {
          id: newId(),
          name: '',
          waypoints: [],
          startTime: '07:30',
          pace: 'stredni',
          roundTrip: true,
          breakMin: 20,
        },
      )
      setView('editor')
    }, 'push')

  const back = () => navigate(() => setView('tabs'), 'pop')

  const pickRoute = (id: string) => {
    setState((s) => ({ ...s, activeRouteId: id }))
    setTab('verdikt')
  }

  if (!state.seenIntro) {
    return (
      <UvodScreen
        onDemo={() => {
          setState((s) => ({
            ...s,
            seenIntro: true,
            // Když si někdo ukázku smazal a úvod si pustil znovu, vrátí se.
            routes: s.routes.some((r) => r.id === DEMO_ROUTE.id) ? s.routes : [DEMO_ROUTE, ...s.routes],
            activeRouteId: DEMO_ROUTE.id,
          }))
          setTab('verdikt')
        }}
        onOwn={() => {
          setState((s) => ({ ...s, seenIntro: true }))
          openEditor(null)
        }}
      />
    )
  }

  if (view === 'settings') {
    return (
      <div className="app">
        <NastaveniScreen
          state={state}
          onBack={back}
          onSettings={(settings) => setState((s) => ({ ...s, settings }))}
          onShowIntro={() => setState((s) => ({ ...s, seenIntro: false }))}
        />
      </div>
    )
  }

  if (view === 'editor' && editing) {
    const existing = state.routes.some((r) => r.id === editing.id)
    return (
      <div className="app">
        <EditorScreen
          route={editing}
          paceScale={state.settings.paceScale}
          isNew={!existing}
          onCancel={back}
          onSave={(r) =>
            navigate(() => {
              saveRoute(r)
              setView('tabs')
              setTab('verdikt')
            }, 'pop')
          }
          onDelete={
            existing
              ? () =>
                  navigate(() => {
                    deleteRoute(editing.id)
                    setView('tabs')
                    setTab('trasy')
                  }, 'pop')
              : undefined
          }
        />
      </div>
    )
  }

  return (
    <div className="app">
      {tab === 'trasy' && (
        <TrasyScreen
          state={state}
          activeRoute={route}
          onPick={pickRoute}
          onNew={() => openEditor(null)}
          onImported={(r) => openEditor(r)}
          onEdit={(r) => openEditor(r)}
          onDelete={deleteRoute}
          onSettings={() => navigate(() => setView('settings'), 'push')}
        />
      )}
      {tab === 'verdikt' && (
        <VerdiktScreen
          route={route}
          routes={state.routes}
          data={data}
          assessment={assessment}
          week={week}
          start={start}
          onStartChange={setStart}
          onPickRoute={(id) => setState((s) => ({ ...s, activeRouteId: id }))}
          onEdit={() => route && openEditor(route)}
          onNew={() => openEditor(null)}
        />
      )}
      {tab === 'kdy' && (
        <KdyJitScreen
          route={route}
          data={data}
          week={week}
          start={start}
          onPickStart={(d) => {
            setStart(d)
            setTab('verdikt')
          }}
        />
      )}
      {tab === 'slunce' && <SlunceScreen route={route} data={data} week={week} assessment={assessment} />}
      {tab === 'vybava' && (
        <VybavaScreen
          route={route}
          data={data}
          assessment={assessment}
          state={state}
          onToggle={(name) =>
            setState((s) => {
              if (!route) return s
              const current = s.packed[route.id] ?? []
              const next = current.includes(name) ? current.filter((n) => n !== name) : [...current, name]
              return { ...s, packed: { ...s.packed, [route.id]: next } }
            })
          }
          onReset={() => setState((s) => (route ? { ...s, packed: { ...s.packed, [route.id]: [] } } : s))}
          onBaseGearChange={(baseGear) => setState((s) => ({ ...s, baseGear }))}
        />
      )}
      <TabBar active={tab} onChange={setTab} />
    </div>
  )
}
