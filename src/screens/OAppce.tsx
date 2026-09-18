import { Icon } from '../components/Icon'
import { Diagnostika } from '../components/Diagnostika'
import { Section } from '../components/Section'

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
      <div className="topbar">
        <button className="btn-icon" onClick={onBack} aria-label="Zpět">
          <Icon name="back" size={20} stroke={2} />
        </button>
        <h1>O appce</h1>
        <span className="wordmark" style={{ fontSize: 10, color: 'var(--paper-4)' }}>
          NAVRCHOL
        </span>
      </div>

      <div className="scroll">
        <div className="sec" style={{ marginTop: 18 }}>
          <p className="body" style={{ fontSize: 14 }}>
            NaVrchol počítá počasí zvlášť pro každý bod tvojí trasy a pro jeho nadmořskou výšku,
            a to ze čtyř modelů naráz. Z toho udělá jedno rozhodnutí: jít, nebo nejít.
          </p>
          <p className="footnote" style={{ marginTop: 8 }}>
            verze {__BUILD_ID__}
          </p>
        </div>

        {!standalone && (
          <div className="sec sec--tight">
            <div className="note">
              <Icon name="plus" size={15} stroke={2} />
              <div>
                <strong>Přidej si to na plochu.</strong> Na iPhonu tlačítko Sdílet a pak „Přidat na
                plochu". Na Androidu nabídka prohlížeče a „Nainstalovat aplikaci". Pak to běží na
                celou obrazovku jako běžná appka.
              </div>
            </div>
          </div>
        )}

        <Section label="Co znamenají ta čísla">
          <div className="rows">
            {POJMY.map((p) => (
              <div className="row" key={p.term} style={{ alignItems: 'flex-start', paddingTop: 12, paddingBottom: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{p.term}</div>
                  <div className="hint" style={{ marginTop: 4 }}>
                    {p.text}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section label="Odkud jsou data">
          <p className="hint">
            Předpověď, výšky a geokódování: <a href="https://open-meteo.com">Open-Meteo</a>. Trasy po
            pěšinách: <a href="https://brouter.de">BRouter</a>. Srážkový radar:{' '}
            <a href="https://rainviewer.com">RainViewer</a>. Mapy:{' '}
            <a href="https://opentopomap.org">OpenTopoMap</a> a OpenStreetMap, tmavý podklad Esri.
          </p>
        </Section>

        <Section label="Soukromí">
          <p className="hint">
            Žádný účet, žádné sledování, žádný server. Trasy i sbalená výbava zůstávají jen v tomhle
            telefonu. Ven odchází pouze souřadnice bodů trasy, aby se k nim dala stáhnout předpověď.
          </p>
        </Section>

        <Section label="Rozměry tohoto telefonu">
          <Diagnostika />
        </Section>

        <div className="sec" style={{ marginTop: 26 }}>
          <button className="btn btn--ghost" onClick={onShowIntro}>
            Zobrazit úvod znovu
          </button>
          <p className="footnote" style={{ textAlign: 'center', marginTop: 12 }}>
            Když se appka chová divně po aktualizaci, otevři ji s ?clear-sw=1 na konci adresy.
          </p>
        </div>
      </div>
    </div>
  )
}
