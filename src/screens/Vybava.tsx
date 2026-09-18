import { useState } from 'react'
import { Icon } from '../components/Icon'
import { Empty, ErrorState, Loading } from '../components/States'
import { clock, dayLabel } from '../lib/format'
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
  onBaseGearChange: (items: BaseGearItem[]) => void
}

export function VybavaScreen({ route, data, assessment, state, onToggle, onBaseGearChange }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  if (!route) {
    return <div className="scroll"><Empty title="Žádná trasa" hint="Vyber trasu a poskládám ti k ní výbavu." /></div>
  }
  if (data.error) return <div className="scroll"><ErrorState message={data.error} onRetry={data.reload} /></div>

  const packed = new Set(state.packed[route.id] ?? [])
  const auto = assessment?.gear ?? []
  const total = auto.length + state.baseGear.length
  const done = [...auto.map((g) => g.name), ...state.baseGear.map((g) => g.name)].filter((n) =>
    packed.has(n),
  ).length

  const addItem = () => {
    const name = draft.trim()
    if (!name) return
    onBaseGearChange([...state.baseGear, { id: newId(), name }])
    setDraft('')
  }

  return (
    <div className="scroll">
      <div className="pad" style={{ paddingTop: 22 }}>
        <div className="row-between" style={{ alignItems: 'flex-end' }}>
          <h1 className="page-title">Výbava</h1>
          <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--acc)' }}>
            {done} / {total}
          </span>
        </div>
        <div style={{ height: 5, borderRadius: 3, background: 'var(--card-3)', marginTop: 10, overflow: 'hidden' }}>
          <div
            style={{
              width: total ? `${(done / total) * 100}%` : '0%',
              height: '100%',
              borderRadius: 3,
              background: 'var(--acc)',
              transition: 'width 180ms ease',
            }}
          />
        </div>
        <div className="sub" style={{ marginTop: 8 }}>
          {route.name}
          {assessment ? ` · ${dayLabel(assessment.start)} · ${clock(assessment.start)}` : ''}
        </div>
      </div>

      <div className="pad" style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, paddingBottom: 8 }}>
          <Icon name="sun" size={14} stroke={2.2} color="var(--acc)" />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--acc)' }}>
            PŘIDÁNO PODLE POČASÍ
          </span>
        </div>

        {!assessment ? (
          <Loading what="Skládám výbavu podle předpovědi…" />
        ) : auto.length === 0 ? (
          <div className="card-2" style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.45 }}>
            Podmínky si nic navíc nevynutily. Stačí tvůj základ.
          </div>
        ) : (
          <div className="stack" style={{ gap: 6 }}>
            {auto.map((item) => (
              <GearRow
                key={item.name}
                name={item.name}
                why={item.why}
                checked={packed.has(item.name)}
                onToggle={() => onToggle(item.name)}
                highlight
              />
            ))}
          </div>
        )}
      </div>

      <div className="pad" style={{ marginTop: 18 }}>
        <div className="row-between" style={{ alignItems: 'baseline', paddingBottom: 8 }}>
          <span className="section-label">MŮJ ZÁKLAD</span>
          <button className="mono" style={{ fontSize: 10.5, color: 'var(--acc)' }} onClick={() => setEditing((v) => !v)}>
            {editing ? 'hotovo' : 'upravit'}
          </button>
        </div>

        <div className="stack" style={{ gap: 5 }}>
          {state.baseGear.map((item) => (
            <GearRow
              key={item.id}
              name={item.name}
              checked={packed.has(item.name)}
              onToggle={() => onToggle(item.name)}
              onRemove={
                editing ? () => onBaseGearChange(state.baseGear.filter((g) => g.id !== item.id)) : undefined
              }
            />
          ))}
        </div>

        {editing && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addItem()}
              placeholder="Přidat do základu"
              style={{
                flexGrow: 1,
                minHeight: 44,
                padding: '0 13px',
                borderRadius: 11,
                background: 'var(--card-2)',
                border: '1px solid var(--line)',
                color: 'var(--fg)',
                fontSize: 14,
                fontFamily: 'var(--font)',
              }}
            />
            <button
              onClick={addItem}
              style={{
                width: 44,
                minHeight: 44,
                borderRadius: 11,
                background: 'var(--acc)',
                color: 'var(--acc-ink)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Přidat položku"
            >
              <Icon name="plus" size={20} stroke={2.4} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function GearRow({
  name,
  why,
  checked,
  onToggle,
  onRemove,
  highlight,
}: {
  name: string
  why?: string
  checked: boolean
  onToggle: () => void
  onRemove?: () => void
  highlight?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: why ? '9px 12px' : '8px 12px',
        borderRadius: 12,
        background: highlight ? 'var(--acc-wash)' : 'var(--card-2)',
        minHeight: 46,
      }}
    >
      <button
        onClick={onToggle}
        aria-pressed={checked}
        aria-label={checked ? `${name} sbaleno` : `Označit ${name} jako sbalené`}
        style={{
          width: 24,
          height: 24,
          flexShrink: 0,
          borderRadius: 8,
          background: checked ? 'var(--acc)' : 'transparent',
          border: `1.5px solid ${checked ? 'var(--acc)' : 'oklch(0.38 0.02 255)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked && <Icon name="check" size={14} stroke={3.2} color="var(--acc-ink)" />}
      </button>

      <button onClick={onToggle} style={{ flexGrow: 1, textAlign: 'left', minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: why ? 600 : 500,
            color: checked ? 'var(--mute)' : 'var(--fg)',
            textDecoration: checked ? 'line-through' : 'none',
          }}
        >
          {name}
        </div>
        {why && (
          <div className="mono" style={{ fontSize: 10, color: 'oklch(0.66 0.05 220)', marginTop: 2 }}>
            {why}
          </div>
        )}
      </button>

      {onRemove && (
        <button onClick={onRemove} aria-label={`Smazat ${name}`} style={{ color: 'var(--faint)', padding: 6 }}>
          <Icon name="trash" size={16} />
        </button>
      )}
    </div>
  )
}
