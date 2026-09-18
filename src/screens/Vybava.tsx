import { useState } from 'react'
import { Icon } from '../components/Icon'
import { Scroll } from '../components/Scroll'
import { Section } from '../components/Section'
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
  const names = [...auto.map((g) => g.name), ...state.baseGear.map((g) => g.name)]
  const done = names.filter((n) => packed.has(n)).length

  const addItem = () => {
    const name = draft.trim()
    if (!name) return
    onBaseGearChange([...state.baseGear, { id: newId(), name }])
    setDraft('')
  }

  return (
    <Scroll onRefresh={data.reload} refreshing={data.loading}>
      <header className="masthead">
        <div className="between" style={{ alignItems: 'baseline' }}>
          <h1>Výbava</h1>
          <span className="mono" style={{ fontSize: 15, fontWeight: 600 }}>
            {done}<span style={{ color: 'var(--paper-4)' }}>/{names.length}</span>
          </span>
        </div>
        {/* Jeden zářez = jedna věc. Spojitý pruh by zatajil, kolik toho zbývá. */}
        <div className="ticks" style={{ marginTop: 14, marginBottom: 12 }}>
          {names.map((name) => (
            <span key={name} data-on={packed.has(name)} />
          ))}
        </div>
        <div className="meta">
          {route.name}
          {assessment ? ` · ${dayLabel(assessment.start)} · ${clock(assessment.start)}` : ''}
        </div>
      </header>

      <Section label="Přidáno podle počasí" meta={auto.length > 0 ? `${auto.length}` : undefined}>
        {!assessment ? (
          <Loading what="skládám výbavu podle předpovědi" />
        ) : auto.length === 0 ? (
          <p className="body">Podmínky si nic navíc nevynutily. Stačí tvůj základ.</p>
        ) : (
          <div className="rows">
            {auto.map((item) => (
              <GearRow
                key={item.name}
                name={item.name}
                why={item.why}
                checked={packed.has(item.name)}
                onToggle={() => onToggle(item.name)}
              />
            ))}
          </div>
        )}
      </Section>

      <Section
        label="Můj základ"
        meta={
          <button className="mono" style={{ fontSize: 11, color: 'var(--paper)', textDecoration: 'underline' }} onClick={() => setEditing((v) => !v)}>
            {editing ? 'hotovo' : 'upravit'}
          </button>
        }
      >
        <div className="rows">
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
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <input
              className="field"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addItem()}
              placeholder="Přidat do základu"
            />
            <button className="btn-icon btn-icon--solid" onClick={addItem} aria-label="Přidat položku">
              <Icon name="plus" size={19} stroke={2.2} />
            </button>
          </div>
        )}
      </Section>
    </Scroll>
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
    <div className="row">
      <button
        className="chk"
        onClick={onToggle}
        aria-pressed={checked}
        aria-label={checked ? `${name} sbaleno` : `Označit ${name} jako sbalené`}
      >
        <Icon name="check" size={13} stroke={3} />
      </button>

      <button onClick={onToggle} style={{ flexGrow: 1, textAlign: 'left', minWidth: 0 }}>
        <div
          style={{
            fontSize: 14.5,
            fontWeight: 500,
            color: checked ? 'var(--paper-4)' : 'var(--paper)',
            textDecoration: checked ? 'line-through' : 'none',
          }}
        >
          {name}
        </div>
        {/* Důvod je u položky pořád, ne jen při prvním zobrazení — jinak se
            nedá zpochybnit, proč to appka do batohu přidala. */}
        {why && <div className="footnote" style={{ marginTop: 2 }}>{why}</div>}
      </button>

      {onRemove && (
        <button className="btn-icon" onClick={onRemove} aria-label={`Smazat ${name}`} style={{ width: 34, height: 34 }}>
          <Icon name="trash" size={15} />
        </button>
      )}
    </div>
  )
}
