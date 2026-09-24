import { useEffect, useMemo, useState } from 'react'
import { Diagnostika } from '../components/Diagnostika'
import { Icon } from '../components/Icon'
import { Screen } from '../components/Screen'
import { Cell, Section } from '../components/ui'
import { calibrate, planFromTrack } from '../lib/pace'
import { walkedRoute } from '../lib/plan'
import { withReturn } from '../lib/routing'
import { duration, num } from '../lib/format'
import { readCached } from '../state/routeCache'
import type { Settings, StoredState } from '../state/store'

const HOW: Array<{ title: string; text: string }> = [
  {
    title: 'Předpověď podél celé trati',
    text: 'Trať se vzorkuje po kilometrech a do předpovědi jde nejvyšší místo, nejnižší místo i výrazné vrcholy po cestě, každé se svou nadmořskou výškou. Pro každou hodinu túry se pak podle tempa dohledá, kde zrovna jsi, a teplota se přepočítá na výšku tohohle místa.',
  },
  {
    title: 'Vítr na hřebenech',
    text: 'Model počítá vítr nad vyhlazeným terénem, na hřebeni proto fouká víc, než ukazuje. Na Sněžce model v 10 m hlásí v průměru 4,4 m/s, observatoř měří 10,2 m/s (leden–srpen 2026). Nad hranicí lesa se proto vítr dorovná na vítr volné atmosféry ve stejné výšce a nárazy na jeho 1,5násobek. Chyba průměrného větru tím klesla na polovinu a appka zachytí 76 % hodin s nárazy nad 75 km/h místo 64 %.',
  },
  {
    title: 'Nepříznivý scénář',
    text: 'Rizika se berou z ansámblu: desítek běhů modelů ICON-D2, ICON-EU a ECMWF s trochu jinými vstupy. Skóruje se z nepříznivé čtvrtiny scénářů, ne z nejpravděpodobnější hodnoty. Túra se plánuje na horší variantu.',
  },
  {
    title: 'Skóre a verdikt',
    text: 'Každá hodina túry dostane 0–100 bodů. Skóre trasy je ze 60 % nejslabší hodina a ze 40 % průměr. Nad 65 je verdikt jdi, 35–64 zvaž, pod 35 nejdi. Nárazy nad 75 km/h nad lesem, bouřky, mlha pod 300 m nebo mokro s chladem a větrem znamenají nejdi bez ohledu na zbytek.',
  },
  {
    title: 'Jistota',
    text: 'O kolik se skóre liší mezi příznivým a nepříznivým scénářem ansámblu. Nízká jistota znamená, že se máš rozhodnout až ráno podle radaru.',
  },
  {
    title: 'Čas chůze',
    text: 'Toblerova funkce na každém úseku trati zvlášť, s vyhlazenou výškou. Počítá se i pauza nahoře a sníh, který zpomaluje. Když si tempo zkalibruješ podle ušlé túry, odhady sedí na tebe, ne na průměr.',
  },
  {
    title: 'Obrat před bouřkou',
    text: 'Appka najde první hodinu, kdy energie pro bouřky (CAPE) přeleze 500 J/kg a v aspoň dvou pětinách scénářů prší. Od ní odečte sestup z vrcholu pod hranici lesa po skutečné trati a řekne, kdy se nejpozději otočit a kdy nejpozději vyrazit.',
  },
]

interface Props {
  state: StoredState
  onBack: () => void
  onSettings: (settings: Settings) => void
  onShowIntro: () => void
}

export function NastaveniScreen({ state, onBack, onSettings, onShowIntro }: Props) {
  const [taps, setTaps] = useState(0)
  const standalone = typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches
  const scale = state.settings.paceScale
  const pct = Math.round((scale - 1) * 100)

  return (
    <Screen
      compact
      title="Nastavení"
      leading={
        <button className="bar-btn" onClick={onBack} style={{ paddingLeft: 2 }}>
          <Icon name="back" size={22} stroke={2.4} />
          Trasy
        </button>
      }
    >
      <Section
        title="Moje tempo"
        footer="Zadej, jak dlouho ti opravdu trvala některá z uložených tras — čistá chůze bez delších zastávek. Appka si podle toho upraví všechny odhady."
      >
        <div className="list">
          <Cell
            icon="walk"
            tone={pct === 0 ? undefined : 'jdi'}
            title={pct === 0 ? 'Průměrné tempo' : pct > 0 ? `O ${pct} % rychlejší než průměr` : `O ${-pct} % pomalejší než průměr`}
            sub={
              state.settings.calibratedFrom
                ? `Podle trasy ${state.settings.calibratedFrom.routeName}`
                : 'Zatím nekalibrováno'
            }
          >
            {pct !== 0 && (
              <button className="link t-sub" onClick={() => onSettings({ paceScale: 1 })}>
                Zrušit
              </button>
            )}
          </Cell>
        </div>
        <Calibration state={state} onSettings={onSettings} />
      </Section>

      <Section title="Jak NaVrchol počítá">
        <div className="list">
          {HOW.map((h) => (
            <details key={h.title} className="cell" style={{ display: 'block' }}>
              <summary className="between" style={{ listStyle: 'none', cursor: 'pointer', minHeight: 28 }}>
                <span className="cell-title">{h.title}</span>
                <Icon name="chevronDown" size={16} stroke={2.2} color="var(--ink-4)" />
              </summary>
              <p className="t-sub muted" style={{ paddingTop: 8, paddingBottom: 4, textWrap: 'pretty' }}>
                {h.text}
              </p>
            </details>
          ))}
        </div>
      </Section>

      {!standalone && (
        <Section title="Na plochu">
          <div className="list">
            <Cell
              icon="share"
              title="Přidej si NaVrchol na plochu"
              sub="Na iPhonu Sdílet → Přidat na plochu. Pak běží na celou obrazovku a funguje i offline."
            />
          </div>
        </Section>
      )}

      <Section
        title="Data"
        footer="Žádný účet, žádné sledování, žádný server. Ven odcházejí jen souřadnice míst na trase, aby se k nim dala stáhnout předpověď."
      >
        <div className="list">
          <Cell title="Předpověď, výšky, geokódování" value="Open-Meteo" />
          <Cell title="Trasy po pěšinách" value="BRouter" />
          <Cell title="Mapa a značené trasy" value="OpenTopoMap" />
          <Cell title="Srážkový radar" value="RainViewer" />
          <Cell title="Ověření větru" value="IMGW" />
        </div>
      </Section>

      <Section title="O appce">
        <div className="list">
          <Cell title="Verze" value={__BUILD_ID__} onClick={() => setTaps((t) => t + 1)} />
          <Cell title="Zobrazit úvod" chevron onClick={onShowIntro} />
          <Cell
            title="Načíst znovu od nuly"
            sub="Když se po aktualizaci chová divně."
            chevron
            onClick={() => location.assign('/?clear-sw=1')}
          />
        </div>
      </Section>

      {taps >= 5 && (
        <Section title="Rozměry telefonu">
          <div className="list">
            <Diagnostika />
          </div>
        </Section>
      )}
    </Screen>
  )
}

/** Kalibrace tempa z trasy, kterou člověk opravdu ušel. */
function Calibration({ state, onSettings }: { state: StoredState; onSettings: (s: Settings) => void }) {
  const routes = state.routes.filter((r) => r.waypoints.length > 1)
  const [routeId, setRouteId] = useState(routes[0]?.id ?? '')
  const [hours, setHours] = useState('')
  const [minutes, setMinutes] = useState('')
  const [predicted, setPredicted] = useState<number | null>(null)
  const route = routes.find((r) => r.id === routeId) ?? null

  useEffect(() => {
    setPredicted(null)
    if (!route) return
    let alive = true
    void readCached(route).then((bundle) => {
      if (!alive || !bundle) return
      const track = route.roundTrip ? withReturn(bundle.track) : bundle.track
      const plan = planFromTrack(track, { ...walkedRoute(route), paceScale: state.settings.paceScale }, new Date())
      setPredicted(plan.walkingMinutes)
    })
    return () => {
      alive = false
    }
  }, [route, state.settings.paceScale])

  const actual = (Number(hours) || 0) * 60 + (Number(minutes) || 0)
  const next = useMemo(
    () => (predicted && actual > 0 ? Math.min(1.8, Math.max(0.5, state.settings.paceScale * calibrate(predicted, actual))) : null),
    [predicted, actual, state.settings.paceScale],
  )

  if (routes.length === 0) return null

  return (
    <div className="list mt-12">
      <div className="cell">
        <span className="cell-title grow">Trasa</span>
        <select
          value={routeId}
          onChange={(e) => setRouteId(e.target.value)}
          style={{ border: 'none', background: 'none', color: 'var(--accent)', textAlign: 'right', maxWidth: '60%' }}
        >
          {routes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
      <div className="cell">
        <span className="cell-title grow">Odhad appky</span>
        <span className="cell-value">{predicted ? duration(predicted) : 'otevři trasu'}</span>
      </div>
      <div className="cell">
        <span className="cell-title grow">Šel jsem ji za</span>
        <input
          inputMode="numeric"
          className="field num"
          style={{ width: 58, textAlign: 'center' }}
          placeholder="h"
          value={hours}
          onChange={(e) => setHours(e.target.value.replace(/\D/g, '').slice(0, 2))}
          aria-label="Hodiny"
        />
        <input
          inputMode="numeric"
          className="field num"
          style={{ width: 66, textAlign: 'center' }}
          placeholder="min"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value.replace(/\D/g, '').slice(0, 2))}
          aria-label="Minuty"
        />
      </div>
      {next !== null && route && (
        <div className="cell">
          <div className="cell-main">
            <div className="cell-title">
              {next >= state.settings.paceScale ? 'Jsi rychlejší' : 'Jsi pomalejší'}, nové tempo {num(next * 100)} %
            </div>
            <div className="cell-sub">Všechny časy se přepočítají.</div>
          </div>
          <button
            className="btn btn--small"
            onClick={() => {
              onSettings({ paceScale: next, calibratedFrom: { routeName: route.name, at: Date.now() } })
              setHours('')
              setMinutes('')
            }}
          >
            Uložit
          </button>
        </div>
      )}
    </div>
  )
}
