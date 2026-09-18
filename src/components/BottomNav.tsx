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
      {TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          aria-current={active === t.id ? 'page' : undefined}
        >
          <Icon name={t.icon} size={20} stroke={1.7} />
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  )
}
