import { Icon, type IconName } from '../components/Icon'

const BODY: Array<{ icon: IconName; title: string; text: string }> = [
  {
    icon: 'verdikt',
    title: 'Řekne rozhodnutí, ne počasí',
    text: 'Skóre 0 až 100 a jedno slovo: jdi, zvaž, nejdi. A hned pod tím rozpad, co přesně ti body sebralo — ať to jde rozporovat.',
  },
  {
    icon: 'trasy',
    title: 'Počítá pro tvůj vrchol, ne pro nejbližší město',
    text: 'Čtyři modely naráz, do každého jde nadmořská výška každého bodu. Když se modely rozejdou, appka to řekne rovnou, místo aby předstírala jistotu.',
  },
  {
    icon: 'kdy',
    title: 'Poradí, v kolik vyrazit',
    text: 'Projde všechny hodiny sedmi dní a najde okno, kdy se trasa dá projít nejlíp. Plus východy a západy slunce a výbava, kterou si vynutilo počasí.',
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
        <div className="pad" style={{ paddingTop: 44 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="peak" size={20} stroke={2.4} color="var(--acc)" />
            <span className="wordmark" style={{ fontSize: 13 }}>NAVRCHOL</span>
          </div>

          <h1 className="disp" style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.02, marginTop: 18 }}>
            Jít,
            <br />
            nebo nejít?
          </h1>

          <p style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--dim)', marginTop: 14, textWrap: 'pretty' }}>
            Počasí na túru, které ti dá odpověď místo obrázku sluníčka.
          </p>
        </div>

        <div className="pad stack" style={{ gap: 10, marginTop: 26 }}>
          {BODY.map((b) => (
            <div key={b.title} className="card" style={{ display: 'flex', gap: 13, alignItems: 'flex-start' }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  flexShrink: 0,
                  borderRadius: 11,
                  background: 'var(--acc-wash)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name={b.icon} size={19} stroke={1.9} color="var(--acc)" />
              </div>
              <div className="stack" style={{ gap: 4, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, letterSpacing: '-0.01em' }}>{b.title}</div>
                <div style={{ fontSize: 12.5, lineHeight: 1.45, color: 'var(--dim)', textWrap: 'pretty' }}>
                  {b.text}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="pad stack" style={{ gap: 9, marginTop: 24, paddingBottom: 28 }}>
          <button className="btn" onClick={onDemo}>
            <Icon name="peak" size={18} stroke={2.2} />
            Ukázat to na Sněžce
          </button>
          <button className="btn btn-ghost" onClick={onOwn}>
            <Icon name="plus" size={17} stroke={2} />
            Rovnou si zadat vlastní trasu
          </button>
          <p style={{ fontSize: 11, lineHeight: 1.5, color: 'var(--faint)', textAlign: 'center', marginTop: 6 }}>
            Nic se nikam neposílá a nechce to žádný účet. Trasy zůstávají v tomhle telefonu.
          </p>
        </div>
      </div>
    </div>
  )
}
