# 発音コーチ · 日语发音练习

A tiny, no-backend web app to stop reading Japanese kanji with Chinese pronunciation.

- **练习 (Practice):** see the kanji → say it out loud → the browser listens and scores how
  close your pronunciation was → reveals reading (kana + romaji), Chinese meaning, and an
  example sentence. Tap 🔊 to hear the correct pronunciation. Weak words come back sooner
  (lightweight SM-2 spaced repetition).
- **识别 (Identify):** the reverse direction — when you *don't* know the Japanese reading,
  tap 🎤 and say the word using its **Chinese** pronunciation. Recognition runs in `zh-CN`,
  captures the kanji you spoke, looks it up, shows the correct Japanese reading + meaning, and
  auto-plays the audio. Tap **加入练习** to drop it into your practice library.
- **词库 (Library):** browse / search every phrase, replay audio, see your stats.
- **添加 (Add):** add a phrase by hand (only the kanji is required).

### Identify lookup layers
1. **Your library** + **`dict.js`** — ~115 curated common words with **Chinese** meanings and
   false-friend (trap) warnings.
2. **JMdict** (`jmdict.json.gz`, ~200k entries) — lazy-loaded fallback giving the correct
   reading + **English** gloss for essentially any word. Loaded once per session (gzipped
   ~8.7 MB, decompressed in the browser via `DecompressionStream`).

The lookup bridges the simplified-Chinese → Japanese-kanji gap (say 学习 → finds 学習): the
curated layer uses per-entry keys plus a learned character map, and the JMdict layer is
pre-indexed under simplified-Chinese aliases (composed from OpenCC character tables). Every
recognition alternative is tried to dodge Mandarin homophones.

## Dictionary data (JMdict)
`jmdict.json.gz` is generated from [yomidevs/jmdict-yomitan](https://github.com/yomidevs/jmdict-yomitan)
(JMdict, **CC BY-SA 4.0**), with simplified-Chinese aliases from
[OpenCC](https://github.com/BYVoid/OpenCC) (Apache-2.0). To regenerate:

```bash
cd tools/build
curl -LO https://github.com/yomidevs/jmdict-yomitan/releases/latest/download/JMdict_english.zip
curl -LO https://raw.githubusercontent.com/BYVoid/OpenCC/master/data/dictionary/JPShinjitaiCharacters.txt
curl -LO https://raw.githubusercontent.com/BYVoid/OpenCC/master/data/dictionary/TSCharacters.txt
python3 ../build_jmdict.py JMdict_english.zip JPShinjitaiCharacters.txt TSCharacters.txt ../../jmdict.json
gzip -9 -kf ../../jmdict.json   # produces jmdict.json.gz (shipped); raw jmdict.json is gitignored
```

## How content gets added
Tell Claude a phrase (you can use the Chinese reading). Claude replies with the Japanese
pronunciation and appends a full entry to `library.js`. Your practice scores live in
`localStorage` and are matched by `id`, so adding/editing the library never wipes progress.

## Run it
Speech recognition + mic need a *secure context*, so open it via `localhost` (not by
double-clicking the file):

```bash
cd jp-pronounce
python3 serve.py 8123
# then open http://localhost:8123 in Chrome (best) or Safari
```

On first 🎤 tap, allow microphone access.

## Browser support
- **Speech recognition** (the 🎤 grading): Chrome / Edge / Safari. Needs internet.
- **Text-to-speech** (🔊): all modern browsers; quality depends on installed Japanese voices
  (macOS "Kyoko" works well).

## Files
- `index.html` — markup & tabs
- `styles.css` — styling
- `app.js` — practice queue, SM-2, speech recognition + TTS, identify/lookup, library, add form
- `library.js` — the practice phrase library (edit this to add words to drill)
- `dict.js` — curated lookup dictionary for the Identify tab (kanji → reading + Chinese)
- `jmdict.json.gz` — large JMdict fallback dictionary (generated; see above)
- `serve.py` — tiny static server for `localhost`
- `tools/build_jmdict.py` — converts the jmdict-yomitan release into `jmdict.json`
- `test/harness.js` — headless logic tests (run with macOS `jsc`, see below)

## Tests
```bash
/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc test/harness.js
```
