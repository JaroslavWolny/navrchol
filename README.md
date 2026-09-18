# NaVrchol

Plánovač túr, který místo obrázku sluníčka řekne, **jestli jít, kdy vyrazit a co si vzít**.
Mobilní PWA, česky, bez účtu a bez backendu.

## Proč to existuje

Běžné počasí appky odpovídají na otázku „jaké bude v sobotu". Na horách potřebuješ
odpověď na jinou: „v kolik mám vyrazit a co mě na hřebeni čeká, až tam v 9:20 dorazím".

## Jak se počítá přesnost

**Ensemble místo jednoho modelu.** Podle polohy se vybere nejjemnější dostupný model
plus tři hrubší pro porovnání (`src/lib/openMeteo.ts`):

| oblast | primární model | rozlišení |
|---|---|---|
| Alpy | ICON-CH1 **a** AROME naráz | 1 km / 1,3 km |
| Francie, Pyreneje | AROME | 1,3 km |
| Česko, Německo, Rakousko, Polsko | ICON-D2 | 2,2 km |
| zbytek světa | ICON, ECMWF, GFS, GEM | globální |

Z modelů se bere **medián**, ne průměr — jeden ujetý model tak nestrhne výsledek.
Jejich rozptyl se ukazuje jako „shoda modelů": když se rozcházejí, appka to řekne
rovnou, místo aby předstírala jistotu.

**Nadmořská výška.** Do API jde výška každého bodu zvlášť. Bez toho by předpověď
pro vrchol ve 1 603 m vycházela z hodnoty pro údolí — a to je rozdíl šesti stupňů.

**Skutečná trasa, ne vzdušná čára.** Mezi body se dopočítá cesta po pěšinách
(BRouter, profil `hiking-beta`). U Sněžky z Pece je rozdíl 5,2 km vzdušnou čarou
vs. 7,0 km po pěšině. BRouter navíc vrací výšku v každém bodě, takže výškový profil
je zadarmo a Toblerova funkce se počítá na každém úseku zvlášť.

**Nejhorší místo váží 60 %.** Túra je tak dobrá jako její nejslabší úsek. Průměr by
zatajil jednu smrtelnou hodinu na hřebeni mezi sedmi hezkými.

**Tvrdé zákazy přebijí skóre.** Nárazy nad 75 km/h na exponovaném místě, bouřka
s CAPE nad 1 200, viditelnost pod 300 m nebo pocitově −15 °C ve větru znamenají
NEJDI bez ohledu na to, jak hezky vyšel zbytek.

**Skóre jde rozporovat.** Verdikt neukáže jen číslo, ale i jeho rozpad: kolik bodů
sebral chlad, vítr, srážky, bouřka, viditelnost a námraza — a v kterém bodě trasy.
Nedůvěřivé číslo bez zdůvodnění je k ničemu.

**Radar přímo u verdiktu.** Když se modely rozcházejí, appka radí ověřit si radar —
tak ho rovnou ukáže (RainViewer, poslední dvě hodiny, bez klíče).

**Barevnost východu a západu** se počítá z oblačnosti po vrstvách: vysoká chytá
barvu (ideál kolem 45 %), nízká zacloní obzor a je proto **násobič**, ne sčítanec —
při zavřeném obzoru nepomůže sebehezčí cirrus nad hlavou.

## Stack

Vite + React + TypeScript, Leaflet nad OpenTopoMap, Vitest. **Žádný backend** —
Open-Meteo i BRouter mají CORS a nechtějí klíč, takže se volají rovnou z prohlížeče.

## Vývoj

```bash
nvm use 20
npm install
npm run dev
npm test        # 41 testů včetně živých proti Open-Meteo a BRouteru
npm run build
```

## Data

- [Open-Meteo](https://open-meteo.com) — předpověď, geokódování, výšky (CC-BY 4.0)
- [BRouter](https://brouter.de) — routování po pěšinách
- [RainViewer](https://rainviewer.com) — srážkový radar
- [OpenTopoMap](https://opentopomap.org) / OpenStreetMap — mapové dlaždice (CC-BY-SA)
- Esri Dark Gray Canvas — tmavý podklad pod radar

## Testování iOS geometrie bez telefonu

iOS dává PWA přidané na plochu různé okno podle toho, jaký status bar si appka
vyžádala **v okamžiku instalace** — pozdější aktualizace s tím nehnou.
`tools/ios-harness.html` obě varianty vykreslí vedle sebe:

```bash
npm run dev -- --port 5185
cp tools/ios-harness.html public/__ios.html
open http://127.0.0.1:5185/__ios.html
rm public/__ios.html   # ať se to nevystavuje v produkci
```

Naměřeno na iPhonu 15 Pro (obrazovka 393×852):

| | rozpěrka | nadpis | lišta končí | pás dole |
|---|---|---|---|---|
| `black-translucent` | 59px | y=79 ✓ | 793 | **59 px** — mimo webové okno |
| `black` | 0px | y=79 ✓ | 852 | 0 px |

U `black-translucent` iOS okno o horní zónu zkrátí (393×793), ale zónu dál hlásí
jako 59px. Spodních 59 px obrazovky pak appce vůbec nepatří a **zevnitř se to
opravit nedá** — jediná cesta je smazat ikonu z plochy a přidat ji znovu.

## Když se nasazená změna neprojeví

Skoro vždycky je to zaseklý service worker. Otevři appku s `?clear-sw=1` — odregistruje
se a vyčistí všechny cache.
