# NaVrchol — redesign (světlý režim)

## Zadání pro Claude Code

Přestyluj existující appku NaVrchol podle mockupů ve složce `mockups/`.

- Měň **jen vizuál a layout**: barvy, písma, rozestupy, tvary karet, ikony, spodní navigaci.
- **Neměň logiku, data, výpočty ani texty**, které appka generuje (skóre, časy, předpověď). Hodnoty v mockupech jsou ukázkové.
- Zachovej všechny funkce, které appka má. Kde mockup něco nemá, nech to v appce a nastyluj stejným jazykem.
- Jen světlý režim. Pokud appka má tmavý režim, zatím ho vypni nebo nech být — řešíme později.
- Mapy (OpenTopoMap) a grafy zůstávají skutečné; v mockupu jsou jen nakreslené vrstevnice jako zástupný obrázek. Přestyluj jen jejich obal (zaoblení, ovládací tlačítka, barva trasy a značek).
- Postupuj po obrazovkách, po každé ukaž výsledek. Začni design tokeny (CSS proměnné) a sdílenými komponentami.

## Jak číst mockupy

Každý soubor `mockups/*.dc.html` je jedna obrazovka 390 px široká. Styl je **inline** u každého prvku — ten je specifikace (přesné px, barvy, rádiusy).

- `{{něco}}` = hodnota vypočítaná ve `<script>` bloku na konci souboru (data, stav, barvy podle stavu).
- `<sc-for list="{{items}}" as="x">` = smyčka přes pole, `<sc-if>` = podmínka.
- `<x-dc>`, `<helmet>`, `support.js` jsou jen obal editoru — ignoruj.
- V `Main`, `Trasy`, `Verdikt` jsou barvy přes `{{t.bg}}` atd. — hodnoty jsou v objektu `LIGHT` ve scriptu (DARK ignoruj).

| Soubor | Obrazovka |
|---|---|
| `Main.dc.html` | Úvod (onboarding) |
| `Trasy.dc.html` | Seznam tras |
| `Verdikt.dc.html` | Verdikt (hlavní obrazovka) |
| `KdyJit.dc.html` | Kdy jít |
| `Slunce.dc.html` | Slunce |
| `Vybava.dc.html` | Výbava |
| `UpravitTrasu.dc.html` | Upravit trasu |
| `Nastaveni.dc.html` | Nastavení |

## Koncept

Monochromní „alpský“ UI (kamenně šedá + skoro černá) a jediná výrazná barva — **limetková**. Barva se používá jen tam, kde nese význam (verdikt jdi / zvaž / nejdi, aktivní stav). Velká úzká tučná čísla, data v monospace. Logo = turistická značka (pruhy bílá–limetková–bílá na černém čtverci).

## Design tokeny

```css
:root {
  /* plochy */
  --bg: #E9EBE6;        /* pozadí obrazovky */
  --surface: #F7F8F5;   /* karty */
  --sunk: #E3E7E0;      /* zapuštěné prvky: chipy, segmenty, prázdná políčka, profil */
  --map: #E3E7DF;

  /* text */
  --ink: #0E1210;       /* hlavní text, tmavé karty, primární tlačítko */
  --ink-2: #454D48;     /* sekundární */
  --ink-3: #5C645F;     /* popisky, captions (min. kontrast 4.5:1 na --surface) */
  --on-ink: #F2F4EF;    /* text na tmavé */
  --on-ink-2: #A8B0AA;  /* sekundární text na tmavé, neaktivní ikony v liště */

  /* linky */
  --line: #DCE0D9;      /* oddělovače v kartách */
  --line-2: #BEC4BC;    /* obrys sekundárních tlačítek */

  /* verdikt */
  --go: #C8F169;        /* jdi — vždy s textem --ink */
  --warn: #FFC74A;      /* zvaž */
  --stop: #FF6B4E;      /* nejdi */
  --stop-soft: #FFB3A3;

  /* doplňkové */
  --sun: #E59A00;  --sun-tint: #FFE9B8;  --sun-ink: #7A4B00;  --daylight: #FFF1CF;
  --rain: #2453D6; --rain-tint: #DCE5FF;
  --blue-hour: #5B7BE0; --night: #1B2033; --day: #CFDDFB;
  --danger-bg: #F6DED8; --danger-ink: #9E1F14; --danger-icon: #B3261E;

  /* rádiusy */
  --r-hero: 30px;   /* verdikt, nejlepší start, hero slunce */
  --r-card: 24px;   /* běžné karty (22px u dlaždic) */
  --r-btn: 18px;    /* velká tlačítka */
  --r-icon: 14px;   /* ikonová tlačítka 44×44 */
  --r-chip: 10px;
}
```

Stíny téměř nepoužívat. Výjimky: spodní lišta `0 18px 40px -18px rgba(14,18,16,.55)`, plovoucí mapová tlačítka `0 6px 16px -8px rgba(14,18,16,.4)`.

## Typografie

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=Geist+Mono:wght@400;500;600&display=swap">
```

- **Archivo** (variabilní šířka) — vše kromě dat. Nadpisy a velká čísla zúžené přes `font-stretch`.
- **Geist Mono** — čísla v datech, jednotky, časy, malé popisky VERZÁLKAMI.

| Role | Styl |
|---|---|
| Titulek obrazovky | Archivo 54px / 0.9, 800, `font-stretch: 70%`, `letter-spacing: -0.015em` |
| Nadpis sekce | Archivo 30px / 1, 800, stretch 70% (v Upravit trasu / Nastavení 22–26px) |
| „JDI“ ve verdiktu | Archivo 138px / 0.8, 900, stretch 62% |
| Velké číslo (skóre, dlaždice) | Archivo 44–64px / 0.8–0.9, 800, stretch 66–68% |
| Název trasy v kartě | Archivo 26px / 1, 800, stretch 72% |
| Text řádku | Archivo 15px, 600–650 |
| Popisek pod řádkem | Archivo 12.5px, `--ink-3` |
| Body | Archivo 15–16px / 1.4 |
| Mono label | Geist Mono 11px, `letter-spacing: .06em`, uppercase, `--ink-3` |
| Mono hodnota | Geist Mono 14–16px, 600, `font-variant-numeric: tabular-nums` |

## Sdílené komponenty

**Layout obrazovky** — horní odsazení 56–58px (bez falešného status baru), hlavička padding 22px, obsah padding 16px. Mezi sekcemi 40px.

**Nadpis sekce** — flex `space-between`, `align-items: baseline`, padding `0 6px`, margin `40px 0 12px`. Vlevo nadpis, vpravo volitelný mono label (např. „ZÍTRA“, „NEJSLABŠÍ 15:00“).

**Karta** — `--surface`, rádius 24, padding 16. Řádky uvnitř: min-height 52–64px, oddělovač 1px `--line` (poslední bez).

**Řádek se seznamem** — ikona ve čtverci 40×40 (rádius 12, pozadí `--sunk` nebo tematický tint), vpravo text (15px/600 + 12.5px popisek), úplně vpravo mono hodnota.

**Dlaždice (Na trase)** — grid 2×2, gap 10, rádius 22, min-height 132. Mono label s ikonou 16px → velké číslo + mono jednotka → popisek.

**Odznak skóre** — pozadí podle verdiktu (`--go` / `--warn` / `--stop-soft`, prázdné `--sunk`), text vždy `--ink`, Archivo 800 stretch 75%. Velký (karty tras): 62×62, rádius 18, pod číslem mono „JDI“.

**Primární tlačítko** — `--ink`, text `--on-ink`, výška 56–58, rádius 18. Varianta se šipkou: vpravo limetkový čtverec 40×40 (rádius 12) s šipkou.
**Sekundární** — průhledné, obrys 1.5px `--line-2`, výška 52–56.
**Ikonové** — 44×44, rádius 14, `--surface` (u akce „+“ `--ink`).

**Výběr dne (Verdikt)** — grid 7 sloupců, gap 6, výška 66, rádius 16. Mono zkratka dne 9.5px, datum 21px/750, pod tím proužek 16×4 v barvě verdiktu (šedá = nevychází). Vybraný: pozadí `--ink`, text `--bg`.

**Segmentový přepínač** — obal `--sunk`, padding 4, rádius 14; položky výška 40, rádius 10; vybraná `--ink` s textem `--on-ink`.

**Přepínač (switch)** — 54×32, zapnuto: dráha `--ink`, kolečko `--go`; vypnuto: dráha `#C4CAC2`, kolečko `--surface`.

**Checkbox (Výbava)** — 26×26, rádius 8. Prázdný: vnitřní obrys 1.75px `#B2B9B0`. Zaškrtnutý: `--ink` s limetkovou fajfkou, text přeškrtnutý `--ink-3`. Nahoře progress ze 7 segmentů (výška 6, gap 4).

**Spodní lišta** — plovoucí, `left/right 14px`, `bottom 22px`, výška 68, rádius 24, pozadí `--tab` (#0E1210), padding 6, grid 5 sloupců. Položka: ikona 22px + popisek 11px. Neaktivní `--on-ink-2`, aktivní limetkové pozadí (rádius 18) s textem `--ink`. Nad lištou přechod z průhledné do `--bg` (výška 120px), aby obsah plynule mizel.

**Logo** — čtverec 26×26 (rádius 7) `--ink`, padding 5/4, uvnitř tři pruhy nad sebou: 4px `--bg`, 6px `--go`, 4px `--bg` (gap 2). Vedle „NaVrchol“ Archivo 21px/800, stretch 78%.

## Obrazovky — na co dát pozor

**Úvod** — nahoře logo, pod ním vrstevnicová ilustrace s tečkovanou trasou na vrchol a limetkovou „nálepkou“ (otočená −6°, „JDI · ZÍTRA 15:00 · 100/100“). Nadpis 48px s limetkovým zvýrazněním slova „jít.“. Tři funkce jako číslovaný seznam 01–03 s hairline oddělovači. Dole primární + sekundární tlačítko, poznámka o soukromí.

**Trasy** — titulek vlevo, ikonová tlačítka vpravo. Karta trasy 184px: aktivní má vnitřní obrys 2px `--ink` a štítek „● AKTIVNÍ“; ukázková mono štítek „UKÁZKA“. Spodní ~84px karty vyplňuje výškový profil (`--sunk` + linka `--ink-2`, `preserveAspectRatio="none"`, `vector-effect: non-scaling-stroke`), přes něj „Nejlépe tento týden / Zítra, 10:00“ a odznak skóre.

**Verdikt** — meta řádek v mono, název trasy 38px s šipkou (výběr trasy), výběr dne, pak **hlavní limetková karta**: obří „JDI“ vlevo, skóre vpravo, věta, časová osa trasy (černá linka, čtverec = start, čtverec s trojúhelníkem = vrchol na pozici podle času, kolečko = návrat, pod nimi mono časy), dole tlačítko „Start 15:00“ (černé s limetkovým textem). Barva karty podle verdiktu: jdi `--go`, zvaž `--warn`, nejdi `--stop`; text vždy `--ink`. Profil túry: limetková plocha s černou linkou. Sekce Proč X bodů má pruh 60/40 (nejslabší hodina / průměr). Jistota = 10 segmentů. Mapa a radar v jedné kartě.

**Kdy jít** — nahoře černá karta „Nejlepší start“ s limetkovým odznakem a světlým tlačítkem „Naplánovat“. Heatmapa: políčka 30px vysoká, rádius 8, gap 3. Barvy: jdi = limetková s průhledností podle skóre (0.32 při 60 → 1.0 při 96+), zvaž = `--warn`, nejdi = **šrafování** `repeating-linear-gradient(135deg, …)` (silnější červená pod 25 bodů), nevychází = `--sunk`. Nejlepší start = vnitřní obrys 2.5px `--ink`, aktuálně naplánovaný = dvojitý obrys. Graf na vrcholu: denní světlo jako `--daylight` pásy, čára „TEĎ“ s černým štítkem. Seznam po dnech s odznaky.

**Slunce** — hero karta: ilustrace východu s **posterizovanou oblohou** (vodorovné barevné pásy, žádný plynulý gradient) a vrstvenými hřebeny, mono štítek azimutu. Plán ranního výstupu jako černý proužek se třemi hodnotami (Vyraž / Nahoře / Výstup). Světlo = 24h proužek (noc, modrá hodina, zlatá hodina, den). Oblačnost = pruhy s ryskou ideálu 45 % u vysoké. Moře mlhy = malý řez (hladina mlhy čárkovaně vs. vrchol). Noc = tmavá karta. Podle dnů = tabulka východ/západ s odznaky (≥50 `--warn`, 25–49 `#FFE3A0`, jinak `--sunk`).

**Výbava** — počítadlo „2/7“ velkým číslem vpravo od titulku, segmentový progress, karta „Kvůli počasí“, checklist.

**Upravit trasu** — modální obrazovka bez spodní lišty. Hlavička Zrušit / titul / Uložit (černá pilulka s limetkovým textem). Mapa přes celou šířku 384px; obsah pod ní jako „sheet“ se zaoblením 28px nahoře, překrývá mapu o 26px, s úchytem. Trasa na mapě: černá 6px + limetková 2.5px uvnitř + světlý lem 10px. Bod 1 = černé kolečko, poslední bod = limetkový čtverec s černým obrysem. Souhrn (délka, stoupání, chůze, celkem) v černé kartě, „Celkem“ limetkově. Smazat trasu = `--danger-bg` / `--danger-ink`.

**Nastavení** — zpět „‹ Trasy“, sekce v kartách. „Jak NaVrchol počítá“ = rozbalovací řádky číslované 01–07 s „+“. „Přidej na plochu“ = černá karta s limetkovou ikonou. Datové zdroje: popis vlevo, zdroj vpravo v mono.

## Ikony

Lineární SVG, `viewBox="0 0 24 24"`, `stroke-width` 1.8–2, `stroke-linecap/linejoin: round`, barva `currentColor`. Přesné cesty jsou v mockupech (lišta, dlaždice, řádky). Nikde emoji. Pokud appka používá knihovnu ikon (např. Lucide), klidně ji použij — styl odpovídá.

## Přístupnost

- Ovládací prvky jako skutečné `<button>`, `<a>`, `<input>` + `<label>`; ikonová tlačítka s `aria-label`.
- Dotykové plochy min. 44×44.
- Na limetkové / žluté vždy tmavý text `--ink`.
- Verdikt nikdy jen barvou: vždy i slovo (jdi / zvaž / nejdi) nebo číslo; „nejdi“ v heatmapě šrafováním.
