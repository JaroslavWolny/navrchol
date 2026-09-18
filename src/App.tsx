import { useEffect, useMemo, useState } from 'react'
import { BottomNav, type Tab } from './components/BottomNav'
import { EditorScreen } from './screens/Editor'
import { KdyJitScreen } from './screens/KdyJit'
import { SlunceScreen } from './screens/Slunce'
import { TimelineScreen } from './screens/Timeline'
import { TrasyScreen } from './screens/Trasy'
import { VerdiktScreen } from './screens/Verdikt'
import { VybavaScreen } from './screens/Vybava'
import { assess, weekOutlook } from './lib/plan'
import { load, newId, save, type StoredState } from './state/store'
import { useRouteData } from './state/useRouteData'
import type { Route } from './lib/types'

type View = 'tabs' | 'editor' | 'timeline'

/** Nejbližší výskyt času startu — dnes, pokud ještě nebyl, jinak zítra. */
function defaultStart(route: Route | null): Date {
  const now = new Date()
  const [h, m] = (route?.startTime ?? '07:00').split(':').map(Number)
  const d = new Date(now)
  d.setHours(h, m ?? 0, 0, 0)
  if (d <= now) d.setDate(d.getDate() + 1)
  return d
}

export default function App() {
  const [state, setState] = useState<StoredState>(load)
  const [tab, setTab] = useState<Tab>('verdikt')
  const [view, setView] = useState<View>('tabs')
  const [editing, setEditing] = useState<Route | null>(null)

  useEffect(() => save(state), [state])

  const route = state.routes.find((r) => r.id === state.activeRouteId) ?? null
  const data = useRouteData(route)

  const [start, setStart] = useState<Date>(() => defaultStart(route))
  useEffect(() => setStart(defaultStart(route)), [route?.id, route?.startTime])

  const assessment = useMemo(() => {
    if (!route || !data.track || !data.forecast) return null
    return assess(route, data.track, data.forecast, start)
  }, [route, data.track, data.forecast, start])

  const week = useMemo(() => {
    if (!route || !data.track || !data.forecast) return null
    return weekOutlook(route, data.track, data.forecast)
  }, [route, data.track, data.forecast])

  const patchRoute = (next: Route) =>
    setState((s) => ({
      ...s,
      routes: s.routes.some((r) => r.id === next.id)
        ? s.routes.map((r) => (r.id === next.id ? next : r))
        : [...s.routes, next],
      activeRouteId: next.id,
    }))

  const openEditor = (r: Route | null) => {
    setEditing(
      r ?? { id: newId(), name: '', waypoints: [], startTime: '07:00', pace: 'stredni' },
    )
    setView('editor')
  }

  if (view === 'editor' && editing) {
    return (
      <EditorScreen
        route={editing}
        onCancel={() => setView('tabs')}
        onSave={(r) => {
          patchRoute(r)
          setView('tabs')
          setTab('verdikt')
        }}
        onDelete={
          state.routes.some((r) => r.id === editing.id)
            ? () => {
                setState((s) => {
                  const routes = s.routes.filter((r) => r.id !== editing.id)
                  return { ...s, routes, activeRouteId: routes[0]?.id ?? null }
                })
                setView('tabs')
                setTab('trasy')
              }
            : undefined
        }
      />
    )
  }

  if (view === 'timeline') {
    return (
      <TimelineScreen
        route={route}
        track={data.track}
        assessment={assessment}
        onBack={() => setView('tabs')}
      />
    )
  }

  return (
    <div className="app">
      {tab === 'trasy' && (
        <TrasyScreen
          state={state}
          activeRoute={route}
          onPick={(id) => {
            setState((s) => ({ ...s, activeRouteId: id }))
            setTab('verdikt')
          }}
          onNew={() => openEditor(null)}
          onEdit={(r) => openEditor(r)}
        />
      )}
      {tab === 'verdikt' && (
        <VerdiktScreen
          route={route}
          data={data}
          assessment={assessment}
          start={start}
          onStartChange={setStart}
          onEdit={() => route && openEditor(route)}
          onTimeline={() => setView('timeline')}
          onNew={() => openEditor(null)}
        />
      )}
      {tab === 'kdy' && (
        <KdyJitScreen
          route={route}
          data={data}
          week={week}
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
              const next = current.includes(name)
                ? current.filter((n) => n !== name)
                : [...current, name]
              return { ...s, packed: { ...s.packed, [route.id]: next } }
            })
          }
          onBaseGearChange={(baseGear) => setState((s) => ({ ...s, baseGear }))}
        />
      )}
      <BottomNav active={tab} onChange={setTab} />
    </div>
  )
}
