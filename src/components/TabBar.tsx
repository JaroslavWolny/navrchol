import { Icon, type IconName } from './Icon'

export type Tab = 'trasy' | 'verdikt' | 'kdy' | 'slunce' | 'vybava'

const TABS: Array<{ id: Tab; label: string; icon: IconName }> = [
  { id: 'trasy', label: 'Trasy', icon: 'trasy' },
  { id: 'verdikt', label: 'Verdikt', icon: 'verdikt' },
  { id: 'kdy', label: 'Kdy jít', icon: 'kdy' },
  { id: 'slunce', label: 'Slunce', icon: 'slunce' },
  { id: 'vybava', label: 'Výbava', icon: 'vybava' },
]

/** Plovoucí černá lišta; aktivní záložka má limetkový podklad. Obsah pod ní mizí do pozadí. */
export function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <>
      <div className="tab-fade" aria-hidden="true" />
      <nav className="tabbar" aria-label="Hlavní navigace">
        {TABS.map((t) => {
          const on = active === t.id
          return (
            <button key={t.id} onClick={() => onChange(t.id)} aria-current={on ? 'page' : undefined}>
              <Icon name={t.icon} size={22} stroke={1.8} />
              <span>{t.label}</span>
            </button>
          )
        })}
      </nav>
    </>
  )
}
