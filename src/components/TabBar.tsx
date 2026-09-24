import { Icon, type IconName } from './Icon'

export type Tab = 'trasy' | 'verdikt' | 'kdy' | 'slunce' | 'vybava'

const TABS: Array<{ id: Tab; label: string; icon: IconName }> = [
  { id: 'trasy', label: 'Trasy', icon: 'trasy' },
  { id: 'verdikt', label: 'Verdikt', icon: 'verdikt' },
  { id: 'kdy', label: 'Kdy jít', icon: 'kdy' },
  { id: 'slunce', label: 'Slunce', icon: 'slunce' },
  { id: 'vybava', label: 'Výbava', icon: 'vybava' },
]

export function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="tabbar" aria-label="Hlavní navigace">
      {TABS.map((t) => {
        const on = active === t.id
        return (
          <button key={t.id} onClick={() => onChange(t.id)} aria-current={on ? 'page' : undefined}>
            <Icon name={t.icon} size={25} stroke={1.7} filled={on} />
            <span>{t.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
