import { Icon } from '../components/Icon'
import { Mark } from '../components/ui'

interface Props {
  onDemo: () => void
  onOwn: () => void
}

const POINTS = [
  {
    icon: 'verdikt' as const,
    title: 'Verdikt pro celou trasu',
    text: 'Počasí v každém místě trati, v hodinu, kdy tam podle tvého tempa budeš.',
  },
  {
    icon: 'kdy' as const,
    title: 'Kdy vyrazit',
    text: 'Projde každou hodinu startu na týden dopředu a najde nejlepší okno.',
  },
  {
    icon: 'file' as const,
    title: 'Tvoje trasy',
    text: 'Naklikej body na mapě, nebo nahraj GPX z Mapy.cz, Komootu či hodinek.',
  },
]

export function UvodScreen({ onDemo, onOwn }: Props) {
  return (
    <div className="app">
      <div className="scroll" style={{ display: 'flex', flexDirection: 'column', paddingBottom: 20 }}>
        <div className="page" style={{ marginTop: 'max(40px, 9vh)' }}>
          <Mark size={64} />
          <h1 className="t-large" style={{ marginTop: 22, fontSize: 36 }}>
            NaVrchol
          </h1>
          <p className="t-callout muted mt-8" style={{ fontSize: 17, maxWidth: 320 }}>
            Počasí na túru, které řekne, jestli jít, kdy vyrazit a&nbsp;co si vzít.
          </p>
        </div>

        <div className="page stack" style={{ gap: 22, marginTop: 36 }}>
          {POINTS.map((p) => (
            <div key={p.title} className="row" style={{ alignItems: 'flex-start', gap: 16 }}>
              <span style={{ color: 'var(--accent)', marginTop: 2 }}>
                <Icon name={p.icon} size={30} stroke={1.7} />
              </span>
              <div>
                <div className="t-headline">{p.title}</div>
                <div className="t-sub muted mt-4">{p.text}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ flex: 1, minHeight: 32 }} />

        <div className="page stack" style={{ gap: 10 }}>
          <button className="btn" onClick={onDemo}>
            Vyzkoušet na Sněžce
          </button>
          <button className="btn btn--gray" onClick={onOwn}>
            Zadat vlastní trasu
          </button>
          <p className="footer-note" style={{ paddingTop: 10 }}>
            Bez účtu a bez sledování. Trasy zůstávají v&nbsp;tomhle telefonu.
          </p>
        </div>
      </div>
    </div>
  )
}
