import { useEffect, useMemo, useState } from 'react'
import { Diagnostika } from '../components/Diagnostika'
import { Icon, type IconName } from '../components/Icon'
import { Screen } from '../components/Screen'
import { Cell, Logo, Section, Segmented, Switch } from '../components/ui'
import { calibrate, planFromTrack } from '../lib/pace'
import { walkedRoute } from '../lib/plan'
import { withReturn } from '../lib/routing'
import { duration, num } from '../lib/format'
import { readCached } from '../state/routeCache'
import type { BanKey, ComfortKey, Preferences, Tolerance } from '../lib/score'
import type { Settings, StoredState } from '../state/store'

const COMFORT: Array<{ key: ComfortKey; label: string; icon: IconName }> = [
  { key: 'dest', label: 'Déšť', icon: 'drop' },
  { key: 'vitr', label: 'Vítr', icon: 'wind' },
  { key: 'chlad', label: 'Chlad', icon: 'thermo' },
  { key: 'horko', label: 'Horko', icon: 'sun' },
  { key: 'snih', label: 'Sníh', icon: 'snowflake' },
  { key: 'vyhled', label: 'Výhled', icon: 'eye' },
]

const TOLERANCES: Array<{ id: Tolerance; label: string }> = [
  { id: 'vadi', label: 'Vadí' },
  { id: 'bezne', label: 'Běžně' },
  { id: 'nevadi', label: 'Nevadí' },
]

const BANS: Array<{ key: BanKey; label: string; sub: string; icon: IconName }> = [
  { key: 'bourka', label: 'Bouřka', sub: 'CAPE nad 1\u00a0200\u00a0J/kg a srážky', icon: 'bolt' },
  { key: 'vitr', label: 'Vichr na hřebeni', sub: 'Nárazy nad 75\u00a0km/h nad lesem', icon: 'wind' },
  { key: 'podchlazeni', label: 'Podchlazení', sub: 'Mokro, pocitově do 6\u00a0°C a nárazy nad 40\u00a0km/h', icon: 'thermo' },
  { key: 'omrzliny', label: 'Omrzliny', sub: 'Pocitově −15\u00a0°C a nárazy nad 50\u00a0km/h', icon: 'snowflake' },
  { key: 'mlha', label: 'Hustá mlha', sub: 'Viditelnost pod 300\u00a0m', icon: 'eye' },
]

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
    text: 'Každá hodina túry dostane 0–100 bodů. Skóre trasy je ze 60 % nejslabší hodina a ze 40 % průměr. Nad 65 je verdikt jdi, 35–64 zvaž, pod 35 nejdi. Body za déšť, vítr, chlad, horko, sníh a výhled se násobí podle toho, co ti vadí; bouřka, podchlazení a námraza berou vždy stejně. Nárazy nad 75 km/h nad lesem, bouřky, mlha pod 300 m nebo mokro s chladem a větrem znamenají nejdi bez ohledu na zbytek, dokud si zákaz sám nevypneš.',
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
  onSettings: (patch: Partial<Settings>) => void
  onShowIntro: () => void
}

export function NastaveniScreen({ state, onBack, onSettings, onShowIntro }: Props) {
  const [taps, setTaps] = useState(0)
  const standalone = typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches
  const scale = state.settings.paceScale
  const pct = Math.round((scale - 1) * 100)
  const prefs = state.settings.prefs
  const setPrefs = (patch: Partial<Preferences>) => onSettings({ prefs: { ...prefs, ...patch } })

  return (
    <Screen
      title="Nastavení"
      leading={
        <button className="hd-back" onClick={onBack}>
          <Icon name="back" size={22} stroke={2} />
          Trasy
        </button>
      }
    >
      <div className="settings">
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
              <button className="link t-sub" onClick={() => onSettings({ paceScale: 1, calibratedFrom: undefined })}>
                Zrušit
              </button>
            )}
          </Cell>
          <Calibration state={state} onSettings={onSettings} />
        </div>
      </Section>

      <Section
        title="Co mi vadí"
        footer="Každý má „jdi“ jinde. Vadí bere víc bodů, Nevadí přehlédne drobnosti — extrém, třeba průtrž mračen, se počítá dál. Upozornění ve verdiktu zůstanou."
      >
        <div className="list">
          {COMFORT.map((c) => (
            <Cell key={c.key} icon={c.icon} title={c.label}>
              <Segmented
                label={c.label}
                value={prefs.comfort[c.key]}
                options={TOLERANCES}
                onChange={(v) => setPrefs({ comfort: { ...prefs.comfort, [c.key]: v } })}
              />
            </Cell>
          ))}
        </div>
      </Section>

      <Section
        title="Tvrdé zákazy"
        footer="Zapnutý zákaz znamená nejdi, ať vyjde skóre jakkoli. Vypnutý už verdikt nepřebije, ale nebezpečí se dál ukáže nahoře mezi varováními."
      >
        <div className="list">
          {BANS.map((b) => {
            const on = !prefs.bansOff.includes(b.key)
            return (
              <Cell key={b.key} icon={b.icon} tone={on ? undefined : 'nejdi'} title={b.label} sub={b.sub}>
                <Switch
                  checked={on}
                  label={b.label}
                  onChange={(v) =>
                    setPrefs({ bansOff: v ? prefs.bansOff.filter((k) => k !== b.key) : [...prefs.bansOff, b.key] })
                  }
                />
              </Cell>
            )
          })}
        </div>
      </Section>

      <Section title="Jak NaVrchol počítá">
        <div className="list">
          {HOW.map((h, i) => (
            <details key={h.title} className="cell how">
              <summary>
                <span className="label" style={{ width: 22 }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="cell-title grow" style={{ fontWeight: 600 }}>
                  {h.title}
                </span>
                <Icon name="plus" size={18} stroke={2} color="var(--ink-3)" className="how-plus" />
              </summary>
              <p className="t-sub muted" style={{ padding: '0 0 10px 36px', textWrap: 'pretty' }}>
                {h.text}
              </p>
            </details>
          ))}
        </div>
      </Section>

      {!standalone && (
        <div className="install">
          <span>
            <Icon name="share" size={20} stroke={1.9} />
          </span>
          <span className="stack" style={{ gap: 4 }}>
            <span style={{ fontSize: 16, fontWeight: 650 }}>Přidej si NaVrchol na plochu</span>
            <span style={{ fontSize: 13, lineHeight: 1.4, color: 'var(--on-ink-2)' }}>
              Na iPhonu Sdílet → Přidat na plochu. Pak běží na celou obrazovku a funguje i offline.
            </span>
          </span>
        </div>
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

      <div className="stack" style={{ alignItems: 'center', gap: 10, marginTop: 40 }}>
        <Logo size={30} />
        <span className="label" style={{ fontSize: 10.5, letterSpacing: '0.08em' }}>
          NaVrchol · bez účtu
        </span>
      </div>
      </div>
    </Screen>
  )
}

/** Kalibrace tempa z trasy, kterou člověk opravdu ušel. */
function Calibration({ state, onSettings }: { state: StoredState; onSettings: (s: Partial<Settings>) => void }) {
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
    <>
      <div className="cell">
        <span className="grow" style={{ fontSize: 15 }}>Trasa</span>
        <label className="row" style={{ gap: 4, maxWidth: '62%' }}>
          <select
            value={routeId}
            onChange={(e) => setRouteId(e.target.value)}
            aria-label="Trasa"
            style={{ appearance: 'none', border: 'none', background: 'none', color: 'var(--ink)', fontSize: 15, fontWeight: 650, textAlign: 'right', minWidth: 0, maxWidth: '100%' }}
          >
            {routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <Icon name="chevronDown" size={16} stroke={2.2} />
        </label>
      </div>
      <div className="cell">
        <span className="grow" style={{ fontSize: 15 }}>Odhad appky</span>
        <span className="cell-value">{predicted ? duration(predicted) : 'otevři trasu'}</span>
      </div>
      <div className="cell" style={{ gap: 8, minHeight: 64 }}>
        <span className="grow" style={{ fontSize: 15 }}>Šel jsem ji za</span>
        <label className="unit-field" style={{ width: 74 }}>
          <input
            inputMode="numeric"
            value={hours}
            onChange={(e) => setHours(e.target.value.replace(/\D/g, '').slice(0, 2))}
            aria-label="Hodiny"
          />
          <span>h</span>
        </label>
        <label className="unit-field" style={{ width: 88 }}>
          <input
            inputMode="numeric"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value.replace(/\D/g, '').slice(0, 2))}
            aria-label="Minuty"
          />
          <span>min</span>
        </label>
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
    </>
  )
}
