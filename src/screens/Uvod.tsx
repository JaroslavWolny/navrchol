import { Icon } from '../components/Icon'

const CLAIMS: Array<{ title: string; text: string }> = [
  {
    title: 'Řekne rozhodnutí, ne počasí',
    text: 'Skóre 0 až 100 a jedno slovo: jdi, zvaž, nejdi. A hned pod tím rozpad, co přesně ti body sebralo — ať to jde rozporovat.',
  },
  {
    title: 'Počítá pro tvůj vrchol, ne pro nejbližší město',
    text: 'Do předpovědi jde nadmořská výška každého bodu a rizika se berou z ansámblu desítek členů. Když se rozejdou, appka to řekne rovnou, místo aby předstírala jistotu.',
  },
  {
    title: 'Poradí, v kolik vyrazit',
    text: 'Projde všechny hodiny sedmi dní a najde okno, kdy se trasa dá projít nejlíp. Spočítá i obrat před bouřkou, rezervu do tmy a výbavu, kterou si vynutilo počasí.',
  },
]

interface Props {
  onDemo: () => void
  onOwn: () => void
}

export function UvodScreen({ onDemo, onOwn }: Props) {
  return (
    <div className="app">
      <div className="scroll">
        <div className="sec" style={{ marginTop: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, paddingBottom: 12, borderBottom: '1px solid var(--rule)' }}>
            <Icon name="peak" size={18} stroke={2} />
            <span className="wordmark">NAVRCHOL</span>
          </div>

          <h1 className="cond" style={{ fontSize: 46, fontWeight: 700, lineHeight: 0.98, marginTop: 24 }}>
            Jít,
            <br />
            nebo nejít?
          </h1>

          <p className="body" style={{ fontSize: 15, marginTop: 14, maxWidth: 300 }}>
            Počasí na túru, které ti dá odpověď místo obrázku sluníčka.
          </p>
        </div>

        <div className="sec" style={{ marginTop: 32 }}>
          <div className="rows">
            {CLAIMS.map((c, i) => (
              <div className="row" key={c.title} style={{ alignItems: 'flex-start', paddingTop: 14, paddingBottom: 14 }}>
                <span className="mono" style={{ width: 26, flexShrink: 0, fontSize: 12, color: 'var(--paper-4)' }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.005em' }}>{c.title}</div>
                  <div className="hint" style={{ marginTop: 5 }}>
                    {c.text}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="sec" style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 9 }}>
          <button className="btn" onClick={onDemo}>
            <Icon name="peak" size={17} stroke={2} />
            Ukázat to na Sněžce
          </button>
          <button className="btn btn--ghost" onClick={onOwn}>
            <Icon name="plus" size={16} stroke={2} />
            Rovnou si zadat vlastní trasu
          </button>
          <p className="footnote" style={{ textAlign: 'center', marginTop: 6 }}>
            Nic se nikam neposílá a nechce to žádný účet.
            <br />
            Trasy zůstávají v tomhle telefonu.
          </p>
        </div>
      </div>
    </div>
  )
}
