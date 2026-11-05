# Fyzika kolem tebe – továrna na videa

Minutová 3D vysvětlující videa (1080×1920) ve třech jazycích: čeština, angličtina a rumunština.

```
napady/napady.json ──AI (Claude)──▶ content/scripts/NNN.json ──AI hlas (ElevenLabs)──▶ public/generated + content/timelines ──Remotion──▶ out/videos/<jazyk>/NNN-nazev.mp4 + .txt
```

## Nastavení (jednou)
1. `npm install`
2. Zkopíruj `.env.example` do `.env` a doplň `ANTHROPIC_API_KEY` a `ELEVENLABS_API_KEY`.
3. V ElevenLabs si vyber hlasy a doplň jejich ID do `ELEVENLABS_VOICE_CS/EN/RO`.
4. `npx tsx scripts/make-audio.ts` vygeneruje zvukové efekty a hudební smyčky (jsou už v `public/`).

## Denní použití
```bash
npm run generate -- 1-10        # AI napíše scénáře k nápadům 1–10 (CZ/EN/RO najednou)
npm run voice -- 1-10           # AI hlas + časování titulků po slovech
npm run render:batch -- 1-10    # vyrenderuje MP4 a k nim popisek s hashtagy (.txt)
npm run panel                   # panel v prohlížeči: http://localhost:4321
npm run stop                    # korektně zastaví běžící render
```
- Výběr jazyků: `--langs cs,en`
- Přepsání hotových souborů: `--force`
- Počet souběžných úloh: `--concurrency N`
- Bez hudby (hudbu přidáš až v TikToku): `--no-music`
- Všechny nápady: `all`

Hotové soubory se při dalším spuštění přeskočí, takže pipeline jde kdykoli přerušit a pustit znovu. Najednou smí běžet jen jeden render. Druhý se odmítne spustit, aby si rendery nepřepisovaly soubory.

## Panel (`npm run panel`)
- Ukazuje celkový průběh, právě renderované video a odhad zbývajícího času.
- Tlačítkem „⏹ Zastavit render“ render ukončíš.
- Hotová videa si v něm pustíš po jazycích a pod každým je popisek s hashtagy na zkopírování.
- Stejný stav se zapisuje i do `out/STAV.txt`.

## Vzhled
- Každé video má podle svého čísla vlastní kombinaci barevného tématu, písma, stylu úvodního háčku, přechodů a hudby (`src/engine/themes.ts`).
- Vlastní hudbu nahraješ jako MP3 do `public/music/`. Skladby se pak mezi videi střídají místo vestavěných smyček.

## Kontrola a úpravy
- `npm run dev` otevře náhled v Remotion Studiu. Kompozice `Fyzika-cs/en/ro` ukazují scénář č. 1.
- Scénář je obyčejný JSON v `content/scripts/`, takže jde ručně upravit (text, čísla, kamera, díly) a znovu pustit `voice` a `render:batch` s `--force`.
- Knihovna 3D dílů je v `src/engine/Props.tsx`. Nový díl přidej tam a jeho název doplň do `PROP_TYPES` v `src/engine/schema.ts` a do tabulek v `src/engine/anim.ts`. AI ho pak začne sama používat.
- Kamera sama rámuje záběr, aby se do úzkého obrazu na výšku vešly všechny podstatné předměty (`shotFromSpec` v `src/engine/anim.ts`).
