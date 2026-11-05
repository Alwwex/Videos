# Fyzika kolem tebe – Studio

Krátká (~25–30 s) vysvětlující videa o fyzice na výšku (1080×1920) ve **třech jazycích** (CZ, EN, RO)
a aplikace, která je **vyrobí i sama publikuje** na TikTok, Instagram a YouTube – ve výchozím plánu **2× denně**.

## Spuštění (Windows)
1. Nainstaluj [Node.js LTS](https://nodejs.org) (stačí jednou).
2. Dvojklik na **`Spustit Studio.bat`**. Poprvé se nainstalují knihovny (pár minut), pak se otevře okno Studia.
   Černé okno konzole nech běžet (klidně minimalizované) – dokud běží, Studio renderuje a publikuje.

(macOS/Linux: `./spustit-studio.command` nebo `npm run studio`, okno je na http://localhost:4321)

## Jak to používat
| Záložka | Co tam uděláš |
|---|---|
| **Přehled** | Tlačítko **🎬 Vyrobit všechna nová videa** – namluví a vyrenderuje vše, co chybí. Průběh, záznam, kredity. |
| **Videa** | Seznam všech videí, přehrávač (CZ/EN/RO), popisek k zkopírování, zapnutí/vypnutí publikování pro každé video. |
| **Publikování** | Účty (TikTok / Instagram / YouTube + jazyk), přihlášení, časy publikování, historie. |
| **Nastavení** | API klíče (ElevenLabs, Claude), výběr hlasů, AI generování nových scénářů, spouštění s Windows. |

### Kam se videa ukládají
```
out/videos/015-proc-je-obloha-modra/
├── CZ/video.mp4  +  popis.txt   (název, popis, hashtagy)
├── EN/video.mp4  +  popis.txt
└── RO/video.mp4  +  popis.txt
```
Stará videa 1–14 vyrenderovaná ještě do `out/videos/cs|en|ro/` přesuneš do nové struktury v **Nastavení → Uspořádat stará videa**.

### Hlas
- **ElevenLabs**, dokud máš kredity (≈ 430 znaků na jedno video v jednom jazyce → 10 000 kreditů ≈ 23 videí v jednom jazyce).
- Pak (nebo bez klíče) automaticky **zdarma hlas Microsoft Edge** (Antonín / Andrew / Emil), včetně časování titulků.
- V Nastavení můžeš pro každý jazyk zvolit „automaticky / vždy ElevenLabs / vždy zdarma“.
  Tip: ElevenLabs jen pro CZ, EN a RO zdarma.

### Publikování
1. V záložce **Publikování** zkontroluj účty (výchozí: TikTok, Instagram, YouTube – vše CZ; jazyk a počet účtů jde změnit, např. 3 účty × 3 platformy).
2. U každého účtu klikni **🔑 Přihlásit**, v otevřeném okně Chrome/Edge se přihlas a okno zavři. Každý účet má vlastní profil (`data/profiles/`), takže se nepletou.
3. Vyzkoušej **📤 Publikovat teď**, pak zapni **Automatické publikování**. V každém nastaveném čase se na každý účet nahraje jedno další hotové video.
- Videa 1–14 jsou ve výchozím stavu z automatického publikování vyřazená (už je používáš) – v záložce Videa je můžeš zapnout.
- Studio ovládá tvůj normální prohlížeč jako člověk. Když TikTok/Instagram/YouTube změní web a nějaký krok se nepovede, okno zůstane otevřené – dokonči ho ručně a v historii klikni „Označit jako publikované“. Snímek obrazovky chyby je v `data/logs/`.

### Vzhled účtů
Profilovka, YouTube bannery (CZ/EN/RO) a hotové texty bia pro všechny platformy jsou ve složce **`branding/`** – návod v [`branding/PROFILY.md`](branding/PROFILY.md).

### Nová videa pomocí AI (Claude)
V Nastavení vlož Anthropic API klíč a klikni **✨ Vymyslet nová videa**. Témata se berou z `napady/napady.json`
(další v pořadí bez scénáře). Jeden scénář stojí zhruba 0,15–0,25 $; Studio hlídá rozpočet (`AI_BUDGET_USD`, výchozí 2,1 $) a nepřekročí ho.

## Pro pokročilé (příkazová řádka)
```bash
npm run voice -- 15-44                 # hlas (auto: ElevenLabs → Edge)
npm run voice -- 15 --provider edge    # vždy zdarma hlas
npm run render:batch -- 15-44          # render (přeskočí hotové, --force přepíše)
npm run render:batch -- new --langs cs # všechna nová, jen čeština
npm run generate -- next 3             # AI napíše 3 nové scénáře
npm run check                          # kontrola všech scénářů
npm run dev                            # Remotion Studio – náhled (kompozice Short-cs/en/ro)
```

## Jak je to postavené
- `content/scripts/NNN.json` – scénáře. Videa 1–14 = původní 3D engine (`src/engine`), 15+ = nový 2D „blueprint“ engine (`src/v2`):
  velký dvouřádkový nadpis, technický diagram (grafy, rovnice, tachometr, silové diagramy, vlny, částice, oběžné dráhy, optika, pole, kvíz) a titulky po slovech.
- Diagramy (`src/v2/visuals`) a piktogramy (`src/v2/Icons.tsx`) – nový typ přidáš do `src/v2/schema.ts` a `visuals/index.tsx`.
- `scripts/voice.ts` hlas, `scripts/render.ts` render, `scripts/generate.ts` AI scénáře.
- `studio/` – aplikace (server `server.ts`, rozhraní `ui.html`, publikování `publish.ts`, data v `data/studio.json`).
