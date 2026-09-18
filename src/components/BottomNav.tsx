import { Icon, type IconName } from './Icon'

export type Tab = 'trasy' | 'verdikt' | 'kdy' | 'slunce' | 'vybava'

const TABS: Array<{ id: Tab; label: string; icon: IconName }> = [
  { id: 'trasy', label: 'Trasy', icon: 'trasy' },
  { id: 'verdikt', label: 'Verdikt', icon: 'verdikt' },
  { id: 'kdy', label: 'Kdy jít', icon: 'kdy' },
  { id: 'slunce', label: 'Slunce', icon: 'slunce' },
  { id: 'vybava', label: 'Výbava', icon: 'vybava' },
]

export function BottomNav({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="nav">
      {TABS.map((t) => {
        const on = active === t.id
        return (
          <button key={t.id} onClick={() => onChange(t.id)} aria-current={on ? 'page' : undefined}>
            {/* Aktivní ikona má o chlup silnější tah — doplňuje jazýček nad ní,
                aby se stav poznal i periferním viděním. */}
            <Icon name={t.icon} size={20} stroke={on ? 2 : 1.6} />
            <span>{t.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
