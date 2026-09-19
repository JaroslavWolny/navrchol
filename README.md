# NaVrchol

Plánovač túr, který místo obrázku sluníčka řekne, **jestli jít, kdy vyrazit a co si vzít**.
Mobilní PWA, česky, bez účtu a bez backendu.

**Živě: [navrchol.vercel.app](https://navrchol.vercel.app)** — na mobilu přidej na plochu.

## Proč to existuje

Běžné počasí appky odpovídají na otázku „jaké bude v sobotu". Na horách potřebuješ
odpověď na jinou: „v kolik mám vyrazit a co mě na hřebeni čeká, až tam v 9:20 dorazím".

## Jak se počítá přesnost

**Tvar počasí z nejjemnějšího modelu, rizika z ansámblu.** Tohle jsou dvě různé
otázky a dřív na obě odpovídala jedna věc. Teplota, oblačnost po vrstvách,
dohlednost a nulová izoterma se berou z nejjemnějšího modelu, který na dané místo
dosáhne (`best_match` — v Krkonoších ICON-D2 na 2,2 km, v Alpách ICON-CH1).
Veličiny, na kterých stojí rozhodnutí, jdou z pravého ansámblu:

| oblast | ansámbly | členů |
|---|---|---|
| Česko, Německo, Rakousko, Polsko, Alpy | ICON-D2-EPS + ICON-EU-EPS + ECMWF-ENS | 111 |
| zbytek Evropy | ICON-EU-EPS + ECMWF-ENS + GEFS | 122 |
| zbytek světa | ECMWF-ENS + GEFS + GEM | 103 |

Jemný ansámbl sahá jen na dva dny, proto se mísí s hrubšími a každý člen váží stejně.

**Proč ne „shoda čtyř modelů".** Porovnávat ICON-D2 (2,2 km) s ECMWF (11 km) měří
rozlišení, ne nejistotu: ICON-D2 dává na Sněžce nárazy 40—106 km/h, ECMWF 6—63.
Horší je, co ta míra dělala s předstihem — jemné modely po dvou dnech přestanou
vracet data, zbydou dva globály blízko sebe a „shoda" **roste**. Naměřeno na
Sněžce starým vzorcem: 61 % na zítřek, 49 % na pozítří, 77 % na příští pátek.
Ansámbl to má správně, protože jeho rozptyl s předstihem roste (test to hlídá).

**Skóruje se z nepříznivého kvartilu.** Riziková hodnota je horší z dvojice
„jemný model" a „p75 ansámblu" — ostrý jemný model se nesmí ztratit v ansámblu
hrubších členů a chvost ansámblu se nesmí ztratit za jedním hezkým scénářem.
Pravděpodobnost srážek není hodnota z modelu, ale podíl členů, kterým prší.

**Jistota** je to, o kolik bodů se skóre hýbe mezi nejlepší a nepříznivou
variantou ansámblu. Ne „modely se shodly na čísle", ale „verdikt se v rozptylu
nehýbe" — což je jediná otázka, která při rozhodování něco znamená.

**Nadmořská výška.** Do obou API jde výška každého bodu zvlášť. Bez toho by
předpověď pro vrchol ve 1 603 m vycházela z hodnoty pro údolí — a to je rozdíl
šesti stupňů.

**Skutečná trasa, ne vzdušná čára.** Mezi body se dopočítá cesta po pěšinách
(BRouter, profil `hiking-beta`). U Sněžky z Pece je rozdíl 5,2 km vzdušnou čarou
vs. 7,0 km po pěšině. BRouter navíc vrací výšku v každém bodě, takže výškový profil
je zadarmo a Toblerova funkce se počítá na každém úseku zvlášť.

**Skóruje se hodinu po hodině, ne v bodech trasy.** Trasa o dvou bodech na šest
hodin měla dřív oskórované dvě hodiny ze šesti; bouřka mezi nimi do verdiktu
nepromluvila vůbec. Teď se pro každou hodinu túry dohledá, kde v tu hodinu podle
tempa jsi — včetně skutečné výšky trati, takže hřeben mezi dvěma waypointy se
posoudí jako hřeben.

**Túra tam a zpět je celá túra.** Plán uměl jen cestu tam: kdo si návrat nenaklikal
jako další body, tomu se počítala půlka — délka, rezerva do tmy, výbava i to, které
hodiny se vůbec oskórovaly. Přitom odpoledne na sestupu přicházejí bouřky. Přepínač
v editoru trať zrcadlí (obrátka se neopakuje) a Tobler počítá klesání vlastní
rychlostí, takže návrat čas nezdvojnásobí, jen prodlouží.

**Nejhorší hodina váží 60 %.** Túra je tak dobrá jako její nejslabší úsek. Průměr
by zatajil jednu smrtelnou hodinu na hřebeni mezi sedmi hezkými.

**Srážky bez stropu.** Penalizace za déšť se dřív zastavila na 6,7 mm/h, takže
liják a průtrž mračen sebraly stejně bodů a 15 mm/h na hřebeni vycházelo jako
„zvaž". Nová křivka drží první milimetry drahé (mokrý je mokrý) a extrém nechá
utrhnout se dolů: 2 mm/h trvale je „zvaž", 8 mm/h „nejdi", 15 mm/h nula.

**Podchlazení je součin, ne součet.** Osm stupňů, dva milimetry a nárazy 45 km/h
vypadají každý zvlášť nevinně — dohromady je to nejčastější důvod zásahu horské
služby. Mokro s chladem a větrem je proto vlastní penalizace, a nad prahem tvrdý
zákaz. Promočení se navíc kumuluje po hodinách: pátá hodina v dešti bolí víc než
první, protože nasáklé vrstvy netopí ani potom, co přestane pršet.

**Sníh není déšť.** Vodní hodnota sněžení se od srážek odečte a sníh má vlastní
penalizaci — nepromočí, ale zavře značky. Ležící sníh navíc zpomaluje tempo:
prošlapávání se počítá po úsecích podle výšky sněhu v jejich nadmořské výšce, takže
v půl metru vyjde návrat o hodiny později.

**Obrat před bouřkou v hodinách, ne ve frázi.** Appka najde první hodinu, kdy CAPE
přeleze 500 J/kg a aspoň dvě pětiny členů hlásí srážky, a od ní odečte sestup
z nejvyššího bodu pod hranici lesa (po skutečné trati, kratším z obou směrů). Z toho
vyjde čas obratu a nejpozdější start.

**Rozpočet světla a stav terénu.** Pod verdiktem je rezerva mezi koncem túry
a západem slunce a kolik spadlo za 24 a 48 hodin před startem — rozbahněná pěšina,
klouzavé kameny a vysoká voda v brodech jsou věci, které předpověď na samotný den
neřekne.

**Tvrdé zákazy přebijí skóre.** Nárazy nad 75 km/h na exponovaném místě, bouřka
s CAPE nad 1 200, viditelnost pod 300 m, pocitově −15 °C ve větru nebo mokro
s pocitovými 6 °C a nárazy nad 40 km/h znamenají NEJDI bez ohledu na to, jak hezky
vyšel zbytek.

**Skóre jde rozporovat.** Verdikt neukáže jen číslo, ale i jeho rozpad: kolik bodů
sebral chlad, vítr, srážky, podchlazení, promočení, sníh, bouřka, viditelnost
a námraza — a v kterou hodinu a kde na trase.

**Radar přímo u verdiktu.** Když je jistota nízká, appka radí ověřit si radar —
tak ho rovnou ukáže (RainViewer, poslední dvě hodiny, bez klíče).

**Barevnost východu a západu** se počítá z oblačnosti po vrstvách: vysoká chytá
barvu (ideál kolem 45 %), nízká zacloní obzor a je proto **násobič**, ne sčítanec —
při zavřeném obzoru nepomůže sebehezčí cirrus nad hlavou.

**Na fotky se počítá i to, co se nedá stáhnout.** Open-Meteo dává jen východ
a západ pro rovný obzor, takže zbytek si appka spočítá sama (`src/lib/sun.ts`,
`horizon.ts`, `inversion.ts`):

- **Skutečný obzor.** Výšky terénu ve vějíři kolem azimutu slunce řeknou, kdy
  slunce doopravdy vyleze. Ze Sněžky o jedenáct minut dřív než podle tabulky
  (z vrcholu vidíš za obzor), z Pece pod Sněžkou o tři hodiny později a
  v prosinci tam nevyleze vůbec.
- **Modrá a zlatá hodina jako okna**, ne jako okamžik. A nejsou to hodiny:
  v prosinci trvá zlaté světlo skoro sedmdesát minut, v červnu padesát tři —
  slunce tehdy stoupá strměji. Z toho appka dopočítá, v kolik vyrazit, abys
  na vrcholu stál na začátku toho okna.
- **Moře mlhy.** Inverze se pozná z teplotního profilu po tlakových hladinách:
  běžně teplota s výškou klesá, v inverzi roste a horní hrana té vrstvy je
  hladina mlhy. K fotce je pak potřeba být nad ní — pod ní stojíš v mlze.
- **Měsíc a tma.** Fáze, východ a západ Měsíce a astronomický soumrak; k tomu
  výška jádra Mléčné dráhy, protože z padesáté rovnoběžky vyleze sotva na
  jedenáct stupňů a jen část roku.
- **Zákal.** Na vrstvené hřebeny nerozhoduje přízemní dohlednost, ale aerosol
  v celém sloupci (Air Quality API). Je to odhad, ne měření.

## Jak to vypadá a proč

Appka není počasí, je to měřicí přístroj a horský bulletin. Vzhled drží tři pravidla
(`src/styles.css`):

**Barva je údaj.** Sytá barva se smí objevit jen tam, kde nese naměřenou hodnotu —
verdikt, skóre, srážky, barevnost oblohy. Ovládací prvky jsou proto křídově bílé.
Barevné tlačítko nic neměří, takže barvu nemá.

**Plochy dělají linky, ne karty.** Sekce odděluje vlasová linka a popiska veličiny,
ne zaoblený box. Vlastní podklad dostane jen to, co se dá zmáčknout. Poloměr je 4 px,
ne 16 — datový list, ne nástěnka s lístečky.

**Jeden přístroj na skóre.** Číslo samo neřekne, jak daleko je k hranici verdiktu,
proto se skóre nikdy neukazuje bez stupnice 0—100 se zářezy v 35 a 65
(`src/components/Gauge.tsx`). Stejná stupnice je u verdiktu i v seznamu tras.

Písmo je jedna nadrodina ve třech hlasech: IBM Plex Sans na text, Plex Sans Condensed
na verdikt a nadpisy, Plex Mono na naměřené hodnoty s tabulkovými číslicemi. Ikony jsou
vlastní, s hranatými konci a ostrými rohy — kreslí se jako technický výkres, ne jako
zaoblená sada z balíčku.

Táhnutím dolů se stáhne nová předpověď (`src/components/Scroll.tsx`); pod verdiktem
je vidět, v kolik data dorazila. Bez toho vypadá půl hodiny stará předpověď stejně
jako čerstvá.

## Stack

Vite + React + TypeScript, Leaflet nad OpenTopoMap, Vitest. **Žádný backend** —
Open-Meteo i BRouter mají CORS a nechtějí klíč, takže se volají rovnou z prohlížeče.

## Vývoj

```bash
nvm use 20
npm install
npm run dev
npm test        # 63 testů včetně živých proti Open-Meteo a BRouteru
npm run build
```

## Data

- [Open-Meteo](https://open-meteo.com) — předpověď, geokódování, výšky (CC-BY 4.0)
- [Open-Meteo Ensemble](https://open-meteo.com/en/docs/ensemble-api) — ansámbl pro rizika
  (bez klíče, ale s minutovým limitem; když nedorazí, appka jede dál z jemného modelu
  a řekne to)
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
