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

**Předpověď podél celé trati, ne jen v naklikaných bodech.** Trasa „parkoviště →
vrchol" měla dřív předpověď jen na parkovišti a na vrcholu; hřeben mezi nimi neměl
vlastní počasí vůbec. Teď se trať vzorkuje (`src/lib/sites.ts`): nejvyšší a nejnižší
místo, výrazné vrcholy po cestě (vyčnívají o 60 m nad okolí ±1,5 km) a pak
rovnoměrně po délce, nejvýš osm míst. Dvě místa blízko u sebe a ve stejné výšce se
sloučí. Každé jde do API se svou nadmořskou výškou, a pro každou hodinu túry se
teplota ještě přepočítá na výšku bodu trati, kde podle tempa jsi (6,5 °C/km).

**Ansámbl jen ve dvou výškách.** Ansámbl je velká odpověď a Open-Meteo ho počítá do
minutového limitu, takže se stahuje jen v nejnižším a nejvyšším místě a mezi nimi
se kvantily dopočítají lineárně podle výšky. Tlakové hladiny (vítr, teplotní
profil) se stahují zvlášť a jen pro místa nad hranicí lesa a pro vrchol.

**Vítr na hřebenech se dopočítává z volné atmosféry.** Model počítá vítr v 10 m
nad vyhlazeným terénem, takže na vrcholu, který nad okolí vyčnívá, fouká víc, než
ukazuje. Ověřeno proti hodinovým měřením IMGW (leden–srpen 2026, 5 832 hodin):

| | Sněžka (model) | Sněžka (měřeno) | Kasprowy Wierch (model) | Kasprowy (měřeno) |
|---|---|---|---|---|
| průměrný vítr, 10 m | 4,4 m/s | **10,2 m/s** | 4,5 m/s | 5,6 m/s |
| `max(10 m, volná atmosféra)` | 7,6 m/s, chyba 7,3 → 4,3 | | 5,1 m/s, chyba 2,4 → 2,4 | |

Nad hranicí lesa (1 200 m) je proto vítr `max(model, vítr v tlakové hladině ve výšce
místa)` a nárazy `max(model, 1,5 × ten vítr)` — 1,5 je naměřený medián poměru náraz
/ průměr na Sněžce. Hodin s nárazy nad 75 km/h (práh pro tvrdé NEJDI) appka
zachytí 76 % místo 64 %, na chráněném Kasprowém se nic nezhorší. V rozpadu skóre
je u takové hodiny poznámka „dopočteno z volné atmosféry".

**Stoupání s hysterezí.** Prostý součet kladných rozdílů výšky započítá každý schod
šumu; u GPX z hodinek to jsou stovky metrů navíc. Počítá se s hysterezí 5 m, což
sedí na BRouter („filtered ascend" 871 m vs. 868 m u Sněžky). Výšky z GPX se před
výpočtem tempa vyhladí klouzavým průměrem přes ±40 m.

**Skutečná trasa, ne vzdušná čára.** Mezi body se dopočítá cesta po pěšinách
(BRouter, profil `hiking-beta`). U Sněžky z Pece je rozdíl 5,2 km vzdušnou čarou
vs. 7,0 km po pěšině. BRouter navíc vrací výšku v každém bodě, takže výškový profil
je zadarmo a Toblerova funkce se počítá na každém úseku zvlášť. Když BRouter nepojede, spadne se na vzdušnou čáru — ale s výškami terénu každých 150 m, ne jen s výškami koncových bodů.

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

**Pauza nahoře patří do plánu.** Dvacet minut na vrcholu posune návrat, rezervu do
tmy i nejpozdější start před bouřkou — a skóruje se, protože nahoře sedíš
v největším větru. U tam a zpět je pauza na obrátce, jinak na nejvyšším bodě.

**Tempo se dá zkalibrovat na sebe.** Rozdíl mezi lidmi je větší než rozdíl mezi
vzorci pro čas chůze (±30 %). V nastavení se zadá, za jak dlouho člověk opravdu
ušel některou z uložených tras, a všechny odhady se přepočítají jeho tempem.

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

**Meteogram vrcholu s oblačností po výškách.** Vrstvy nízká/střední/vysoká neřeknou,
jestli mrak leží pod vrcholem, na něm, nebo nad ním. Pro vrchol se proto zvlášť
stahuje oblačnost v deseti tlakových hladinách (1000–300 hPa) i s jejich skutečnou
výškou a v záložce Kdy jít se kreslí jako meteogram na celý výhled: teplota,
oblačnost po výškách s čarou vrcholu, srážky a vítr se směrem. Když šedá přetne
čáru vrcholu, budeš nahoře v mraku; když leží celá pod ní, je to moře mlhy.
Graf ukazuje tytéž hodnoty, ze kterých se skóruje (vítr dorovnaný na hřeben,
nárazy a srážky z p75 ansámblu), aby graf a verdikt neříkaly dvě různé věci.
Modely vedle sebe jako meteoblue MultiModel appka záměrně nekreslí, viz „Proč ne
shoda čtyř modelů". Hladiny pod terénem modelu (v horách 1000 hPa) jsou
extrapolované, takže mlha v nížinách je orientační.

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

Appka se má na telefonu chovat jako appka, ne jako web (`src/styles.css`):

**Systémové písmo a systémové vzory.** SF Pro na iPhonu, velké titulky, které při
rolování zajedou do průsvitné lišty, seskupené seznamy, přepínače a segmentové
volby jako v Nastavení. Světlý i tmavý režim podle telefonu. Přechody mezi
obrazovkami přes View Transitions (podřízená obrazovka přijede zprava).

**Barva nese data.** Zelená, oranžová a červená jsou jen verdikt a skóre, žlutá
slunce, azurová déšť. Modrá je akce — tlačítka, odkazy, aktivní záložka.

**Vlastní je to, co ukazuje data.** Pás hodin ve verdiktu (každý díl je jedna hodina
túry v barvě jejího skóre), průběh túry (výškový profil v čase: pauza je rovinka,
nad každou hodinou počasí tam, kde v ní budeš), teplotní mapa startů na týden
a trasa na mapě obarvená podle toho, kde to ten den zlobí.

**Ikona je turistická značka.** Značka KČT „odbočka k vrcholu" — barevný
rovnostranný trojúhelník v bílém čtverci. Na vrchol, NaVrchol.

Texty jsou krátké a česky sázené: pevné mezery za jednopísmennými předložkami
(`vlna()` ve `format.ts`), čas bez úvodní nuly, typografické minus.

Táhnutím dolů se stáhne nová předpověď; poslední předpověď každé trasy zůstává
v IndexedDB, takže bez signálu appka ukáže plán a řekne, jak je starý.

## Stack

Vite + React + TypeScript, Leaflet nad OpenTopoMap, Vitest. Trasy jde naklikat, najít podle jména, nebo nahrát jako GPX (Mapy.cz, Komoot, hodinky). **Žádný backend** —
Open-Meteo i BRouter mají CORS a nechtějí klíč, takže se volají rovnou z prohlížeče.

## Vývoj

```bash
nvm use 20
npm install
npm run dev
npm test        # jednotkové i živé testy proti Open-Meteo, BRouteru a výškám
                # živé se přeskočí, když API hlásí minutový limit (429)
npm run build
```

## Data

- [Open-Meteo](https://open-meteo.com) — předpověď, geokódování, výšky (CC-BY 4.0)
- [Open-Meteo Ensemble](https://open-meteo.com/en/docs/ensemble-api) — ansámbl pro rizika
  (bez klíče, ale s minutovým limitem; když nedorazí, appka jede dál z jemného modelu
  a řekne to)
- [BRouter](https://brouter.de) — routování po pěšinách
- [Waymarked Trails](https://hiking.waymarkedtrails.org) — značené turistické trasy nad mapou v editoru
- [IMGW](https://danepubliczne.imgw.pl) — hodinová měření ze Sněžky a Kasprowého vrchu, jen na ověření větru (appka je nestahuje)
- [RainViewer](https://rainviewer.com) — srážkový radar
- [OpenTopoMap](https://opentopomap.org) / OpenStreetMap — mapové dlaždice (CC-BY-SA)
- Esri Light/Dark Gray Canvas — neutrální podklad pod radar

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
