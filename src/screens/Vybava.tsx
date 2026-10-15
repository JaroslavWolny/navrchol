import { useState } from 'react'
import { Icon } from '../components/Icon'
import { Screen } from '../components/Screen'
import { Section } from '../components/ui'
import { Empty, ErrorState } from '../components/States'
import { capital, clock, dayLabel } from '../lib/format'
import { newId, type BaseGearItem, type StoredState } from '../state/store'
import type { Assessment } from '../lib/plan'
import type { RouteData } from '../state/useRouteData'
import type { Route } from '../lib/types'

interface Props {
  route: Route | null
  data: RouteData
  assessment: Assessment | null
  state: StoredState
  onToggle: (name: string) => void
  onReset: () => void
  onBaseGearChange: (items: BaseGearItem[]) => void
}

export function VybavaScreen({ route, data, assessment, state, onToggle, onReset, onBaseGearChange }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  if (!route) {
    return (
      <Screen title="Výbava">
        <Empty icon="vybava" title="Žádná trasa" hint="Vyber trasu a appka ti k ní poskládá výbavu podle počasí." />
      </Screen>
    )
  }
  if (data.error && !assessment) {
    return (
      <Screen title="Výbava">
        <ErrorState message={data.error} onRetry={data.reload} />
      </Screen>
    )
  }

  const packed = new Set(state.packed[route.id] ?? [])
  const auto = assessment?.gear ?? []
  const names = [...auto.map((g) => g.name), ...state.baseGear.map((g) => g.name)]
  const done = names.filter((n) => packed.has(n)).length

  const addItem = () => {
    const name = draft.trim()
    if (!name) return
    onBaseGearChange([...state.baseGear, { id: newId(), name }])
    setDraft('')
  }

  return (
    <Screen
      title="Výbava"
      subtitle={`${route.name}${assessment ? ` · ${dayLabel(assessment.start)} ${clock(assessment.start)}` : ''}`}
      titleAside={
        <span aria-live="polite" style={{ fontSize: 40, lineHeight: 0.9, fontWeight: 800, fontStretch: '70%', fontVariantNumeric: 'tabular-nums' }}>
          {done}
          <span style={{ color: '#9aa29c' }}>/{names.length}</span>
        </span>
      }
    >
      <div style={{ padding: '0 22px', marginTop: 18 }}>
        {/* Jeden dílek = jedna věc. Spojitý pruh by zatajil, kolik toho zbývá. */}
        <div className="progress" aria-hidden="true">
          {names.map((name) => (
            <i key={name} data-on={packed.has(name)} />
          ))}
        </div>
      </div>

      <Section
        title="Kvůli počasí"
        aside={auto.length > 0 ? <span className="aside">{auto.length}</span> : undefined}
        footer={
          assessment && auto.length > 0
            ? `Podle předpovědi na ${dayLabel(assessment.start)} od ${clock(assessment.start)} do ${clock(assessment.end)}.`
            : undefined
        }
      >
        <div className="list">
          {!assessment ? (
            <div className="cell">
              <div className="skel grow" style={{ height: 18 }} />
            </div>
          ) : auto.length === 0 ? (
            <div className="cell">
              <span className="cell-icon" data-tone="jdi">
                <Icon name="check" size={18} stroke={2.2} />
              </span>
              <div className="cell-main">
                <div className="cell-title">Nic navíc</div>
                <div className="cell-sub">Počasí si nic nevynutilo, stačí základ.</div>
              </div>
            </div>
          ) : (
            auto.map((item) => (
              <GearRow key={item.name} name={item.name} why={capital(item.why)} checked={packed.has(item.name)} onToggle={() => onToggle(item.name)} />
            ))
          )}
        </div>
      </Section>

      <Section
        title="Vždycky"
        aside={
          <button className="aside" onClick={() => setEditing((v) => !v)}>
            {editing ? 'Hotovo' : 'Upravit'}
          </button>
        }
      >
        <div className="list">
          {state.baseGear.map((item) => (
            <GearRow
              key={item.id}
              name={item.name}
              checked={packed.has(item.name)}
              onToggle={() => onToggle(item.name)}
              onRemove={editing ? () => onBaseGearChange(state.baseGear.filter((g) => g.id !== item.id)) : undefined}
            />
          ))}
          {editing && (
            <div className="cell" style={{ gap: 8 }}>
              <input
                className="field grow"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addItem()}
                placeholder="Přidat věc"
                enterKeyHint="done"
              />
              <button className="icon-btn icon-btn--filled" onClick={addItem} aria-label="Přidat položku" style={{ margin: 0, width: 40, height: 40 }}>
                <Icon name="plus" size={20} stroke={2.2} />
              </button>
            </div>
          )}
        </div>
      </Section>

      {done > 0 && (
        <div className="page mt-24">
          <button className="btn btn--gray" onClick={onReset}>
            Odškrtnout všechno
          </button>
        </div>
      )}
    </Screen>
  )
}

function GearRow({
  name,
  why,
  checked,
  onToggle,
  onRemove,
}: {
  name: string
  why?: string
  checked: boolean
  onToggle: () => void
  onRemove?: () => void
}) {
  return (
    <div className="cell" style={{ minHeight: 56, paddingRight: onRemove ? 6 : 16 }}>
      <button
        onClick={onToggle}
        className="row grow"
        style={{ gap: 14, textAlign: 'left' }}
        aria-pressed={checked}
        aria-label={checked ? `${name}, sbaleno` : `${name}, nesbaleno`}
      >
        <span className="check" data-on={checked}>
          <Icon name="check" size={16} stroke={3} />
        </span>
        <span className="grow">
          <span
            style={{
              display: 'block',
              fontSize: 16,
              fontWeight: 500,
              color: checked ? 'var(--ink-3)' : undefined,
              textDecoration: checked ? 'line-through' : undefined,
            }}
          >
            {name}
          </span>
          {/* Důvod je u položky pořád — jinak se nedá zpochybnit, proč ji appka přidala. */}
          {why && <span className="cell-sub" style={{ display: 'block' }}>{why}</span>}
        </span>
      </button>
      {onRemove && (
        <button className="icon-btn" onClick={onRemove} aria-label={`Smazat ${name}`} style={{ color: 'var(--danger-icon)' }}>
          <Icon name="trash" size={18} stroke={2} />
        </button>
      )}
    </div>
  )
}
