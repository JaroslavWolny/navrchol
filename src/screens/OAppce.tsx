import { Icon } from '../components/Icon'

const POJMY: Array<{ term: string; text: string }> = [
  {
    term: 'Skóre a verdikt',
    text: '0 až 100. Nad 65 jdi, 35 až 64 zvaž, pod 35 nejdi. Skóre trasy je ze 60 % z jejího nejslabšího místa a ze 40 % z průměru všech bodů — jedna zlá hodina na hřebeni váží víc než šest hezkých v lese. Bouřka, nárazy nad 75 km/h na exponovaném místě nebo viditelnost pod 300 m skóre přebijí úplně.',
  },
  {
    term: 'Shoda modelů',
    text: 'Předpověď se netahá z jednoho modelu, ale ze čtyř. Shoda říká, jak moc se mezi sebou srovnaly. Vysoká shoda znamená, že se dá předpovědi věřit. Nízká znamená, že se máš radši rozhodnout až ráno podle radaru.',
  },
  {
    term: 'CAPE',
    text: 'Zásoba energie v atmosféře pro bouřku, v joulech na kilogram. Pod 300 se prakticky nic neděje, nad 1 200 s deštěm je to na hřebeni vážná věc.',
  },
  {
    term: 'Nulová izoterma',
    text: 'Výška, ve které je právě nula stupňů. Když je pod vrcholem a prší, budou kameny namrzlé.',
  },
  {
    term: 'Exponované místo',
    text: 'Bod trasy nad 1 200 m, tedy zhruba nad hranicí lesa. Vítr i bouřka se tam počítají přísněji, protože se nemáš kam schovat.',
  },
  {
    term: 'Barevnost východu a západu',
    text: 'Počítá se z oblačnosti po vrstvách. Vysoká chytá barvu, ideál je kolem 45 %. Nízká zacloní obzor a zruší představení bez ohledu na to, co je nad ní.',
  },
]

interface Props {
  onBack: () => void
  onShowIntro: () => void
}

export function OAppceScreen({ onBack, onShowIntro }: Props) {
  const standalone =
    typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches

  return (
    <div className="app">
      <div className="pad" style={{ paddingTop: 20, paddingBottom: 10, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={onBack} aria-label="Zpět" style={{ padding: 4, color: 'var(--dim)' }}>
            <Icon name="back" size={22} stroke={2.2} />
          </button>
          <h1 className="disp" style={{ fontSize: 19, fontWeight: 700 }}>O appce</h1>
        </div>
      </div>

      <div className="scroll">
        <div className="pad">
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 13.5, lineHeight: 1.5, textWrap: 'pretty' }}>
              NaVrchol počítá počasí zvlášť pro každý bod tvojí trasy a pro jeho nadmořskou výšku,
              a to ze čtyř modelů naráz. Z toho udělá jedno rozhodnutí: jít, nebo nejít.
            </div>
            <div className="mono" style={{ fontSize: 10.5, color: 'var(--mute)' }}>
              verze {__BUILD_ID__}
            </div>
          </div>
        </div>

        {!standalone && (
          <div className="pad" style={{ marginTop: 10 }}>
            <div className="card-2" style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
              <Icon name="plus" size={16} stroke={2.2} color="var(--acc)" style={{ marginTop: 2 }} />
              <div className="stack" style={{ gap: 3 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Přidej si to na plochu</div>
                <div style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--dim)', textWrap: 'pretty' }}>
                  Na iPhonu tlačítko Sdílet a pak „Přidat na plochu". Na Androidu nabídka prohlížeče
                  a „Nainstalovat aplikaci". Pak to běží na celou obrazovku jako běžná appka.
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="pad" style={{ marginTop: 18 }}>
          <div className="section-label" style={{ paddingBottom: 8 }}>CO ZNAMENAJÍ TA ČÍSLA</div>
          <div className="stack" style={{ gap: 8 }}>
            {POJMY.map((p) => (
              <div key={p.term} className="card-2" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--acc)' }}>{p.term}</div>
                <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--dim)', textWrap: 'pretty' }}>
                  {p.text}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pad" style={{ marginTop: 18 }}>
          <div className="section-label" style={{ paddingBottom: 8 }}>ODKUD JSOU DATA</div>
          <div className="card-2" style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--dim)' }}>
            Předpověď, výšky a geokódování: <a href="https://open-meteo.com">Open-Meteo</a>.
            Trasy po pěšinách: <a href="https://brouter.de">BRouter</a>. Srážkový radar:{' '}
            <a href="https://rainviewer.com">RainViewer</a>. Mapy:{' '}
            <a href="https://opentopomap.org">OpenTopoMap</a> a OpenStreetMap, tmavý podklad Esri.
          </div>
        </div>

        <div className="pad" style={{ marginTop: 18 }}>
          <div className="section-label" style={{ paddingBottom: 8 }}>SOUKROMÍ</div>
          <div className="card-2" style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--dim)' }}>
            Žádný účet, žádné sledování, žádný server. Trasy i sbalená výbava zůstávají jen
            v tomhle telefonu. Ven odchází pouze souřadnice bodů trasy, aby se k nim dala stáhnout
            předpověď.
          </div>
        </div>

        <div className="pad stack" style={{ gap: 9, marginTop: 20, paddingBottom: 26 }}>
          <button className="btn btn-ghost" onClick={onShowIntro}>
            Zobrazit úvod znovu
          </button>
          <p style={{ fontSize: 10.5, lineHeight: 1.5, color: 'var(--faint)', textAlign: 'center' }}>
            Když se appka chová divně po aktualizaci, otevři ji s <span className="mono">?clear-sw=1</span> na konci adresy.
          </p>
        </div>
      </div>
    </div>
  )
}
