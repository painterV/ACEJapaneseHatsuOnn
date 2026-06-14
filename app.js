/* 発音コーチ — Japanese pronunciation practice (no backend).
 * Data flow: SEED_LIBRARY (library.js) ⊕ localStorage progress.
 * Entries are matched by id, so editing the library never loses your scores. */
"use strict";

const STORE_KEY = "hatsuon.v1";
const PROGRESS_KEY = "hatsuon.progress.v1";

/* ---------------- storage ---------------- */

/** Load user-added entries + progress from localStorage. */
function loadState() {
  let userEntries = [];
  let progress = {};
  try { userEntries = JSON.parse(localStorage.getItem(STORE_KEY) || "[]"); } catch (_) {}
  try { progress = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}"); } catch (_) {}
  return { userEntries, progress };
}

/** Persist user entries. Returns true on success; alerts loudly on failure
 *  (e.g. private-mode browsers where localStorage throws). */
function saveUserEntries(list) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(list));
    return true;
  } catch (e) {
    alert("保存失败：浏览器存储不可用（可能是隐私/无痕模式或存储已满）。\n" + e.message);
    return false;
  }
}
function saveProgress(p) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
  } catch (e) {
    console.error("saveProgress failed:", e);
  }
}

/** Merge incoming entries into existing ones by id (pure). Returns the merged
 *  list and how many were newly added. Used by the import flow. */
function mergeEntries(existing, incoming) {
  const byId = new Map((existing || []).map((e) => [e.id, e]));
  let added = 0;
  for (const e of incoming || []) {
    if (e && e.id && e.phrase) {
      if (!byId.has(e.id)) added++;
      byId.set(e.id, e);
    }
  }
  return { list: [...byId.values()], added };
}

/** Merge seed library (from library.js) with user-added entries, dedup by id. */
function allEntries() {
  const seed = Array.isArray(window.SEED_LIBRARY) ? window.SEED_LIBRARY : [];
  const { userEntries } = loadState();
  const byId = new Map();
  [...seed, ...userEntries].forEach((e) => { if (e && e.id) byId.set(e.id, e); });
  return [...byId.values()];
}

/* ---------------- dictionary (Identify tab) ---------------- */

let _dictIndex = null;     // key (phrase OR zh, spaces stripped) -> entry
let _simp2ja = null;       // simplified-Chinese char -> Japanese kanji, learned from dict

/** Build the lookup index + char map once. */
function buildDictIndex() {
  if (_dictIndex) return;
  _dictIndex = new Map();
  _simp2ja = {};
  const dict = Array.isArray(window.DICTIONARY) ? window.DICTIONARY : [];
  for (const e of dict) {
    if (!e || !e.phrase) continue;
    _dictIndex.set(e.phrase.replace(/\s/g, ""), e);
    if (e.zh) {
      _dictIndex.set(e.zh.replace(/\s/g, ""), e);
      // learn char correspondences when forms align 1:1
      if (e.zh.length === e.phrase.length) {
        const zc = [...e.zh], pc = [...e.phrase];
        for (let i = 0; i < zc.length; i++) {
          if (zc[i] !== pc[i]) _simp2ja[zc[i]] = pc[i];
        }
      }
    }
  }
}

/** Map a (possibly simplified-Chinese) string toward its Japanese-kanji form. */
function toJaKanji(s) {
  buildDictIndex();
  return [...(s || "")].map((c) => _simp2ja[c] || c).join("");
}

/** Look up a spoken/transcribed word. Checks the dictionary, then the user's
 *  own library, trying the raw text and a simplified->Japanese normalized form. */
function lookupWord(text) {
  buildDictIndex();
  const t = (text || "").replace(/\s/g, "");
  if (!t) return null;
  const tries = [t, toJaKanji(t)];
  for (const cand of tries) {
    if (_dictIndex.has(cand)) return _dictIndex.get(cand);
  }
  // fall back to the user's library (phrase match, raw or normalized)
  const lib = allEntries();
  for (const cand of tries) {
    const hit = lib.find((e) => e.phrase.replace(/\s/g, "") === cand);
    if (hit) return hit;
  }
  return null;
}

/** Is this phrase already in the practice library? */
function inLibrary(phrase) {
  return allEntries().some((e) => e.phrase === phrase);
}

/* ---- JMdict: large lazy-loaded fallback dictionary (~200k entries) ----
 * Data: jmdict.json.gz, built from yomidevs/jmdict-yomitan (CC BY-SA 4.0).
 * Map shape: key -> [reading, englishGloss] for Japanese headwords, and
 *            key -> [reading, englishGloss, japaneseHeadword] for simplified
 *            aliases (so 学习 resolves and still displays 学習). */
let jmdictMap = null;
let jmdictPromise = null;

/** Fetch + gunzip + parse the JMdict map once; cached for the session. */
async function ensureJmdict() {
  if (jmdictMap) return jmdictMap;
  if (jmdictPromise) return jmdictPromise;
  jmdictPromise = (async () => {
    const resp = await fetch("jmdict.json.gz");
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    if (typeof DecompressionStream === "undefined")
      throw new Error("no-decompression-stream");
    const stream = resp.body.pipeThrough(new DecompressionStream("gzip"));
    const text = await new Response(stream).text();
    jmdictMap = JSON.parse(text);
    return jmdictMap;
  })();
  return jmdictPromise;
}

/** Pure lookup against a given JMdict map. Tries the raw text and a
 *  simplified->Japanese normalized form; resolves the display headword from
 *  alias entries. Returns a curated-shaped entry (English gloss in meaning_zh). */
function jmdictLookupIn(map, text) {
  if (!map) return null;
  const t = (text || "").replace(/\s/g, "");
  if (!t) return null;
  let key = t, v = map[t];
  if (!v) { const j = toJaKanji(t); v = map[j]; key = j; }
  if (!v) return null;
  const phrase = v.length > 2 ? v[2] : key;
  return {
    phrase,
    kana: v[0] || "",
    romaji: kanaToRomaji(v[0] || ""),
    meaning_zh: v[1] || "",
    source: "jmdict",
  };
}

/** Look up a word in the loaded JMdict map (or null if not loaded / not found). */
function jmdictLookup(text) {
  return jmdictLookupIn(jmdictMap, text);
}

/* ---------------- kana helpers ---------------- */

/** Katakana → hiragana, strip spaces/punctuation/long marks. For fair comparison. */
function normalizeKana(s) {
  if (!s) return "";
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c >= 0x30a1 && c <= 0x30f6) out += String.fromCodePoint(c - 0x60); // kata→hira
    else out += ch;
  }
  return out
    .replace(/[ー〜。、・！？\s]/g, "")
    .toLowerCase()
    .trim();
}

/* minimal hiragana → romaji (best-effort, for user-added entries lacking romaji) */
const ROMA = {
  きゃ:"kya",きゅ:"kyu",きょ:"kyo",しゃ:"sha",しゅ:"shu",しょ:"sho",ちゃ:"cha",ちゅ:"chu",ちょ:"cho",
  にゃ:"nya",にゅ:"nyu",にょ:"nyo",ひゃ:"hya",ひゅ:"hyu",ひょ:"hyo",みゃ:"mya",みゅ:"myu",みょ:"myo",
  りゃ:"rya",りゅ:"ryu",りょ:"ryo",ぎゃ:"gya",ぎゅ:"gyu",ぎょ:"gyo",じゃ:"ja",じゅ:"ju",じょ:"jo",
  びゃ:"bya",びゅ:"byu",びょ:"byo",ぴゃ:"pya",ぴゅ:"pyu",ぴょ:"pyo",
  あ:"a",い:"i",う:"u",え:"e",お:"o",か:"ka",き:"ki",く:"ku",け:"ke",こ:"ko",
  さ:"sa",し:"shi",す:"su",せ:"se",そ:"so",た:"ta",ち:"chi",つ:"tsu",て:"te",と:"to",
  な:"na",に:"ni",ぬ:"nu",ね:"ne",の:"no",は:"ha",ひ:"hi",ふ:"fu",へ:"he",ほ:"ho",
  ま:"ma",み:"mi",む:"mu",め:"me",も:"mo",や:"ya",ゆ:"yu",よ:"yo",
  ら:"ra",り:"ri",る:"ru",れ:"re",ろ:"ro",わ:"wa",を:"o",ん:"n",
  が:"ga",ぎ:"gi",ぐ:"gu",げ:"ge",ご:"go",ざ:"za",じ:"ji",ず:"zu",ぜ:"ze",ぞ:"zo",
  だ:"da",ぢ:"ji",づ:"zu",で:"de",ど:"do",ば:"ba",び:"bi",ぶ:"bu",べ:"be",ぼ:"bo",
  ぱ:"pa",ぴ:"pi",ぷ:"pu",ぺ:"pe",ぽ:"po",
  ぁ:"a",ぃ:"i",ぅ:"u",ぇ:"e",ぉ:"o",
};
function kanaToRomaji(kana) {
  if (!kana) return "";
  const hira = normalizeKanaSoft(kana);
  let out = "", i = 0;
  while (i < hira.length) {
    const two = hira.substr(i, 2);
    if (ROMA[two]) { out += ROMA[two]; i += 2; continue; }
    const one = hira[i];
    if (one === "っ") { // sokuon: double next consonant
      const next = ROMA[hira.substr(i + 1, 2)] || ROMA[hira[i + 1]] || "";
      if (next) out += next[0];
      i += 1; continue;
    }
    out += ROMA[one] || one;
    i += 1;
  }
  return out;
}
/** like normalizeKana but keeps long marks / punctuation out only, preserves っ ー mapping */
function normalizeKanaSoft(s) {
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c >= 0x30a1 && c <= 0x30f6) out += String.fromCodePoint(c - 0x60);
    else out += ch;
  }
  return out;
}

/* ---------------- similarity ---------------- */

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
  return dp[m][n];
}
/** 0..1 similarity between two strings */
function similarity(a, b) {
  if (!a && !b) return 1;
  const d = levenshtein(a, b);
  return 1 - d / Math.max(a.length, b.length, 1);
}

/** Grade a recognized transcript against an entry. Returns {score, heard}. */
function gradeSpeech(transcript, entry) {
  const heard = (transcript || "").trim();
  const normHeard = normalizeKana(heard);
  // Compare against the kana reading AND the kanji phrase (recognizer may return either).
  const targets = [entry.kana, entry.phrase].filter(Boolean).map(normalizeKana);
  let best = 0;
  for (const t of targets) best = Math.max(best, similarity(normHeard, t));
  // Also compare raw (kanji phrase often comes back verbatim)
  best = Math.max(best, similarity(heard, entry.phrase || ""));
  return { score: Math.round(best * 100), heard };
}

/* ---------------- spaced repetition (SM-2 lite) ---------------- */

function getCard(id) {
  const { progress } = loadState();
  return progress[id] || { ease: 2.5, interval: 0, reps: 0, due: 0, lastScore: null };
}
/** grade: 'again'|'hard'|'good'|'easy' → updates schedule. */
function reviewCard(id, grade, speechScore) {
  const { progress } = loadState();
  const c = progress[id] || { ease: 2.5, interval: 0, reps: 0, due: 0 };
  const q = { again: 1, hard: 3, good: 4, easy: 5 }[grade] ?? 4;
  if (q < 3) { c.reps = 0; c.interval = 0; }
  else {
    c.reps += 1;
    c.interval = c.reps === 1 ? 1 : c.reps === 2 ? 3 : Math.round(c.interval * c.ease);
    c.ease = Math.max(1.3, c.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  }
  c.due = Date.now() + c.interval * 24 * 3600 * 1000;
  if (speechScore != null) c.lastScore = speechScore;
  progress[id] = c;
  saveProgress(progress);
}

/* ---------------- practice queue ---------------- */

let queue = [];
let current = null;

function buildQueue() {
  const now = Date.now();
  const entries = allEntries();
  const withDue = entries.map((e) => ({ e, card: getCard(e.id) }));
  // Due first (overdue earliest), then never-seen, then the rest by soonest due.
  withDue.sort((a, b) => {
    const ad = a.card.due || 0, bd = b.card.due || 0;
    const aDue = ad <= now, bDue = bd <= now;
    if (aDue !== bDue) return aDue ? -1 : 1;
    return ad - bd;
  });
  queue = withDue.map((x) => x.e);
}

/* ---------------- views / DOM ---------------- */

const $ = (sel) => document.querySelector(sel);
const views = ["practice", "identify", "library", "add"];

function switchView(name) {
  views.forEach((v) => {
    $("#view-" + v).classList.toggle("active", v === name);
  });
  document.querySelectorAll(".tab").forEach((t) =>
    t.classList.toggle("active", t.dataset.view === name)
  );
  if (name === "library") renderLibrary();
  if (name === "practice") startPractice();
  if (name === "identify") resetIdentify();
  if (name === "add") { loadApiSettings(); loadTtsSettings(); }
}

document.querySelectorAll(".tab").forEach((t) =>
  t.addEventListener("click", () => switchView(t.dataset.view))
);

/* ---------- practice ---------- */

function startPractice() {
  buildQueue();
  if (!queue.length) {
    $("#practice-card").classList.add("hidden");
    $("#practice-empty").classList.remove("hidden");
    $("#practice-progress").textContent = "";
    return;
  }
  $("#practice-empty").classList.add("hidden");
  $("#practice-card").classList.remove("hidden");
  nextCard();
}

function nextCard() {
  if (!queue.length) { startPractice(); return; }
  current = queue.shift();
  const now = Date.now();
  const card = getCard(current.id);

  $("#p-phrase").textContent = current.phrase;
  $("#p-kana").textContent = current.kana || "";
  $("#p-romaji").textContent = current.romaji || kanaToRomaji(current.kana || "");
  $("#p-meaning").textContent = current.meaning_zh || "";

  const trap = $("#p-trap");
  if (current.trap_zh) { trap.textContent = "⚠️ " + current.trap_zh; trap.classList.remove("hidden"); }
  else trap.classList.add("hidden");

  $("#p-ex").textContent = current.example || "";
  $("#p-ex-kana").textContent = current.example_kana || "";
  $("#p-ex-zh").textContent = current.example_zh || "";
  $("#p-example-box").classList.toggle("hidden", !current.example);

  // reset reveal/speech/grade
  $("#p-reveal").classList.add("hidden");
  $("#speech-result").classList.add("hidden");
  $("#grade-row").classList.add("hidden");
  $("#btn-reveal").classList.remove("hidden");

  const dueTxt = card.due && card.due > now
    ? `下次复习：${new Date(card.due).toLocaleDateString()}`
    : (card.reps ? "到期复习" : "新词");
  $("#due-badge").textContent = dueTxt;
  $("#practice-progress").textContent = `队列中还有 ${queue.length} 个`;
}

function revealAnswer() {
  $("#p-reveal").classList.remove("hidden");
  $("#grade-row").classList.remove("hidden");
  $("#btn-reveal").classList.add("hidden");
}

$("#btn-reveal").addEventListener("click", revealAnswer);
$("#btn-play").addEventListener("click", () => current && speak(current.phrase, current.kana));

document.querySelectorAll("#grade-row .btn").forEach((b) =>
  b.addEventListener("click", () => {
    const score = lastSpeechScore;
    reviewCard(current.id, b.dataset.grade, score);
    lastSpeechScore = null;
    nextCard();
  })
);

/* ---------- TTS: VOICEVOX (if running) → Web Speech (Kyoko) fallback ---------- */

const LOCAL_VOICEVOX = "http://127.0.0.1:50021"; // engine binds IPv4; use 127.0.0.1 not localhost
const TTS_VOICEVOX_URL_KEY = "hatsuon.tts.voicevox_url.v1"; // empty = disabled (public-safe default)
const TTS_SPEAKER_KEY = "hatsuon.tts.speaker.v1"; // VOICEVOX style id
const TTS_RATE_KEY = "hatsuon.tts.rate.v1";       // shared speed (1.0 = normal)
const DEFAULT_SPEAKER = "3";

/** Configured VOICEVOX base URL (trimmed, no trailing slash). Empty = disabled. */
function voicevoxUrl() {
  return (localStorage.getItem(TTS_VOICEVOX_URL_KEY) || "").trim().replace(/\/+$/, "");
}

/** Pick the best Japanese Web Speech voice — prefer macOS "Kyoko" (pure). */
function chooseJaVoice(voices) {
  return (voices || []).find((v) => /kyoko/i.test(v.name) && /ja/i.test(v.lang)) ||
         (voices || []).find((v) => /kyoko/i.test(v.name)) ||
         (voices || []).find((v) => /ja[-_]JP/i.test(v.lang)) ||
         (voices || []).find((v) => /^ja/i.test(v.lang)) || null;
}

let jaVoice = null;
function pickVoice() { jaVoice = chooseJaVoice(speechSynthesis.getVoices()); }
if ("speechSynthesis" in window) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}

const ttsRate = () => Number(localStorage.getItem(TTS_RATE_KEY)) || 1.0;

let _ttsAudio = null;
function playAudioBlob(blob) {
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  if (_ttsAudio) { try { _ttsAudio.pause(); } catch (_) {} }
  const url = URL.createObjectURL(blob);
  _ttsAudio = new Audio(url);
  _ttsAudio.onended = () => URL.revokeObjectURL(url);
  _ttsAudio.play();
}

/** Synthesize via VOICEVOX at `base`. Returns true on success, false to fall back. */
async function speakVoicevox(text, base) {
  try {
    const speaker = localStorage.getItem(TTS_SPEAKER_KEY) || DEFAULT_SPEAKER;
    const q = await fetch(`${base}/audio_query?speaker=${speaker}&text=` + encodeURIComponent(text),
      { method: "POST" });
    if (!q.ok) return false;
    const query = await q.json();
    query.speedScale = ttsRate();
    const s = await fetch(`${base}/synthesis?speaker=${speaker}`,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(query) });
    if (!s.ok) return false;
    playAudioBlob(await s.blob());
    return true;
  } catch (_) { return false; }
}

function speakWebSpeech(text) {
  if (!("speechSynthesis" in window)) { alert("此浏览器不支持语音播放。"); return; }
  if (_ttsAudio) { try { _ttsAudio.pause(); } catch (_) {} }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ja-JP";
  if (jaVoice) u.voice = jaVoice;
  u.rate = ttsRate();
  speechSynthesis.speak(u);
}

/** Speak Japanese; prefer kana (more reliable pronunciation). VOICEVOX first
 *  when engine is "auto" and reachable, else Web Speech (Kyoko). */
async function speak(phrase, kana) {
  const text = kana || phrase;
  if (!text) return;
  const base = voicevoxUrl();
  if (base && await speakVoicevox(text, base)) return;
  speakWebSpeech(text);
}

/* ---------- Speech recognition ---------- */

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognizing = false;
let lastSpeechScore = null;

/** Reusable recognition runner. Calls onResult(transcripts[]) with every
 *  alternative, manages button state, and never leaves the mic stuck on. */
function recognize({ lang, alternatives = 3, onResult, onError, btn, listeningLabel, idleLabel }) {
  if (!SR) {
    alert("此浏览器不支持语音识别（请用 Chrome 或 Safari，并通过 http://localhost 打开）。");
    return;
  }
  if (recognizing) return;
  const rec = new SR();
  rec.lang = lang;
  rec.interimResults = false;
  rec.maxAlternatives = alternatives;
  recognizing = true;
  if (btn) { btn.classList.add("recording"); btn.textContent = listeningLabel; }

  rec.onresult = (ev) => {
    const alts = [];
    for (let i = 0; i < ev.results[0].length; i++) alts.push(ev.results[0][i].transcript);
    onResult(alts);
  };
  rec.onerror = (ev) => onError && onError(ev.error);
  rec.onend = () => {
    recognizing = false;
    if (btn) { btn.classList.remove("recording"); btn.textContent = idleLabel; }
  };
  try { rec.start(); }
  catch (_) {
    recognizing = false;
    if (btn) { btn.classList.remove("recording"); btn.textContent = idleLabel; }
  }
}

/* Practice mic: speak the Japanese, grade against the current card. */
$("#btn-mic").addEventListener("click", () => recognize({
  lang: "ja-JP",
  onResult: (alts) => {
    let best = { score: -1, heard: "" };
    for (const t of alts) {
      const g = gradeSpeech(t, current);
      if (g.score > best.score) best = g;
    }
    showSpeechResult(best);
  },
  onError: (err) => showSpeechResult({
    score: 0,
    heard: err === "no-speech" ? "（没听到声音）" : "（识别失败：" + err + "）",
  }),
  btn: $("#btn-mic"),
  listeningLabel: "🎤 听着…",
  idleLabel: "🎤 说出来",
}));

function showSpeechResult({ score, heard }) {
  lastSpeechScore = score;
  $("#speech-result").classList.remove("hidden");
  $("#heard-text").textContent = heard || "—";
  const fill = $("#score-fill");
  fill.style.width = Math.max(0, Math.min(100, score)) + "%";
  let color = "var(--bad)", label = "";
  if (score >= 80) { color = "var(--good)"; label = `很棒！ ${score}% 接近`; }
  else if (score >= 55) { color = "var(--warn)"; label = `差不多 ${score}%，再练一次`; }
  else { color = "var(--bad)"; label = `${score}%，点 🔊 听正确发音`; }
  fill.style.background = color;
  $("#score-label").textContent = label;
  $("#score-label").style.color = color;
  // auto-reveal so the learner can compare
  revealAnswer();
}

/* ---------- Identify (speak Chinese reading -> find Japanese) ---------- */

let identified = null; // the entry currently shown in the Identify result

function resetIdentify() {
  identified = null;
  $("#id-result").classList.add("hidden");
  $("#id-listening").classList.add("hidden");
  const loading = $("#id-loading");
  loading.classList.add("hidden");
  loading.textContent = "📖 正在加载 JMdict 词典（首次约几秒）…";
  if (!recognizing) {
    $("#btn-id-mic").textContent = "🎤 用中文读音说一个词";
    $("#btn-id-mic-ja").textContent = "🎌 用日语发音说一个词";
  }
}

/** Run identify-by-voice in a given recognition language, then look up the word.
 *  zh-CN: speak the Chinese reading. ja-JP: speak the Japanese pronunciation. */
function identifyByVoice(lang, btnSel, idleLabel) {
  $("#id-result").classList.add("hidden");
  $("#id-listening").classList.remove("hidden");
  recognize({
    lang,
    alternatives: 6,
    onResult: (alts) => { $("#id-listening").classList.add("hidden"); showIdentifyResult(alts); },
    onError: (err) => { $("#id-listening").classList.add("hidden"); showIdentifyResult([], err); },
    btn: $(btnSel),
    listeningLabel: "🎤 听着…",
    idleLabel,
  });
}
$("#btn-id-mic").addEventListener("click", () =>
  identifyByVoice("zh-CN", "#btn-id-mic", "🎤 用中文读音说一个词"));
$("#btn-id-mic-ja").addEventListener("click", () =>
  identifyByVoice("ja-JP", "#btn-id-mic-ja", "🎌 用日语发音说一个词"));

async function showIdentifyResult(alts, err) {
  $("#id-result").classList.remove("hidden");
  $("#id-heard-text").textContent =
    alts[0] || (err ? "识别失败：" + err : "（没听清，再试一次）");

  // Pass 1: user library + curated dictionary (gives Chinese meaning + traps).
  let hit = null, heard = "";
  for (const a of alts) {
    const m = lookupWord(a);
    if (m) { hit = m; heard = a; break; }
  }

  // Pass 2: JMdict fallback (reading + English gloss). Loaded lazily on demand.
  if (!hit && alts.length) {
    $("#id-loading").classList.remove("hidden");
    try {
      await ensureJmdict();
      for (const a of alts) {
        const m = jmdictLookup(a);
        if (m) { hit = m; heard = a; break; }
      }
    } catch (e) {
      $("#id-loading").textContent =
        e.message === "no-decompression-stream"
          ? "此浏览器太旧，无法加载词典（请用较新的 Chrome/Safari）。"
          : "词典加载失败：" + e.message;
      $("#id-found").classList.add("hidden");
      $("#id-notfound").classList.add("hidden");
      return;
    }
    $("#id-loading").classList.add("hidden");
  }

  heard = heard || alts[0] || "";
  $("#id-heard-text").textContent = heard || ($("#id-heard-text").textContent);

  if (hit) renderFound(hit);
  else {
    identified = null;
    $("#id-found").classList.add("hidden");
    $("#id-notfound").classList.remove("hidden");
    $("#id-nf-word").textContent = heard || "（未识别）";
  }
}

/** Render a resolved entry (from dictionary or Claude) into the result card. */
function renderFound(hit) {
  identified = hit;
  $("#id-found").classList.remove("hidden");
  $("#id-notfound").classList.add("hidden");
  $("#id-phrase").textContent = hit.phrase;
  $("#id-kana").textContent = hit.kana || "";
  $("#id-romaji").textContent = hit.romaji || kanaToRomaji(hit.kana || "");
  $("#id-meaning").textContent = hit.meaning_zh || "";

  const src = $("#id-source");
  const label = hit.source === "jmdict" ? "英文释义 · JMdict"
    : hit.source === "claude" ? "由 Claude 生成" : "";
  if (label) { src.textContent = label; src.classList.remove("hidden"); }
  else src.classList.add("hidden");

  const trap = $("#id-trap");
  if (hit.trap_zh) { trap.textContent = "⚠️ " + hit.trap_zh; trap.classList.remove("hidden"); }
  else trap.classList.add("hidden");

  const exBox = $("#id-example");
  if (hit.example) {
    $("#id-ex").textContent = hit.example;
    $("#id-ex-kana").textContent = hit.example_kana || "";
    $("#id-ex-zh").textContent = hit.example_zh || "";
    exBox.classList.remove("hidden");
  } else exBox.classList.add("hidden");

  const already = inLibrary(hit.phrase);
  $("#id-inlib").classList.toggle("hidden", !already);
  $("#id-add").classList.toggle("hidden", already);
  speak(hit.phrase, hit.kana); // auto-play the correct pronunciation
}

$("#id-play").addEventListener("click", () => identified && speak(identified.phrase, identified.kana));

$("#id-add").addEventListener("click", () => {
  if (!identified) return;
  const entry = {
    id: slugify(identified.phrase, identified.kana),
    phrase: identified.phrase,
    kana: identified.kana || "",
    romaji: identified.romaji || kanaToRomaji(identified.kana || ""),
    meaning_zh: identified.meaning_zh || "",
    trap_zh: identified.trap_zh || "",
    example: identified.example || "",
    example_kana: identified.example_kana || "",
    example_zh: identified.example_zh || "",
  };
  const { userEntries } = loadState();
  if (!userEntries.some((e) => e.id === entry.id) && !inLibrary(entry.phrase)) {
    userEntries.push(entry);
    saveUserEntries(userEntries);
  }
  $("#id-inlib").classList.remove("hidden");
  $("#id-add").classList.add("hidden");
});

$("#id-copy").addEventListener("click", () => {
  const word = $("#id-nf-word").textContent || "";
  if (navigator.clipboard && word) {
    navigator.clipboard.writeText(word).then(
      () => { $("#id-copy").textContent = "✓ 已复制"; },
      () => { $("#id-copy").textContent = "复制失败，请手动选择"; }
    );
  }
});

/* ---- type-to-identify: look up typed kanji (Chinese or Japanese) ---- */
function runTypeLookup() {
  const text = $("#id-type-input").value.trim();
  if (text) showIdentifyResult([text]);
}
$("#btn-id-type").addEventListener("click", runTypeLookup);
$("#id-type-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") runTypeLookup();
});
$("#btn-id-type-claude").addEventListener("click", () => {
  const text = $("#id-type-input").value.trim();
  if (text) askAI(text);
});
$("#id-nf-claude").addEventListener("click", () =>
  askAI($("#id-nf-word").textContent || ""));

/* ---------- AI smart-lookup: Gemini (free) or Anthropic ---------- */

const PROVIDER_KEY = "hatsuon.provider.v1";
const DEFAULT_PROVIDER = "openrouter";
const DEFAULT_MODELS = {
  anthropic: "claude-opus-4-8",
  gemini: "gemini-2.0-flash",
  openrouter: "qwen/qwen3-next-80b-a3b-instruct:free",
  deepseek: "deepseek-chat",
};
const MODELS = {
  openrouter: [
    ["qwen/qwen3-next-80b-a3b-instruct:free", "Qwen3 Next 80B（免费 · 中日文强 · 推荐）"],
    ["meta-llama/llama-3.3-70b-instruct:free", "Llama 3.3 70B（免费）"],
    ["google/gemma-4-31b-it:free", "Gemma 4 31B（免费）"],
  ],
  gemini: [
    ["gemini-2.0-flash", "Gemini 2.0 Flash（免费 · 推荐）"],
    ["gemini-2.5-flash", "Gemini 2.5 Flash"],
    ["gemini-1.5-flash", "Gemini 1.5 Flash"],
  ],
  deepseek: [
    ["deepseek-chat", "DeepSeek V3（推荐）"],
    ["deepseek-reasoner", "DeepSeek R1（推理 · 更慢）"],
  ],
  anthropic: [
    ["claude-opus-4-8", "Claude Opus 4.8（最强）"],
    ["claude-sonnet-4-6", "Claude Sonnet 4.6"],
    ["claude-haiku-4-5", "Claude Haiku 4.5（最便宜）"],
  ],
};
const NOTES = {
  openrouter: "OpenRouter Key 来自 openrouter.ai/keys —— 注册即用、无需信用卡。模型列表会自动从 OpenRouter 加载当前真正免费的模型（有速率限制）；选好后记得点「保存设置」。Key 只存在本机浏览器。",
  deepseek: "DeepSeek Key 来自 platform.deepseek.com/api_keys —— 需充值但很便宜，中日文很强。Key 只存在本机浏览器。注意：浏览器直连若报跨域(CORS)错误，则需要自建代理。",
  gemini: "Gemini Key 来自 aistudio.google.com/apikey（AI Studio，非 Google Cloud）—— 免费额度无需信用卡。Key 只存在本机浏览器，查询时直接发送给 Google。",
  anthropic: "Anthropic Key（sk-ant-…）来自 console.anthropic.com，需充值、按用量计费。Key 只存在本机浏览器，查询时直接发送给 Anthropic。",
};

const keyKey = (p) => "hatsuon.apikey." + p + ".v1";
const modelKey = (p) => "hatsuon.model." + p + ".v1";

function fillModelSelect(options, stored) {
  const sel = $("#api-model");
  sel.innerHTML = "";
  for (const [val, label] of options) {
    const o = document.createElement("option");
    o.value = val; o.textContent = label;
    if (val === stored) o.selected = true;
    sel.appendChild(o);
  }
}

function populateModels(provider) {
  const stored = localStorage.getItem(modelKey(provider)) || DEFAULT_MODELS[provider];
  fillModelSelect(MODELS[provider], stored); // static list (fallback while loading)
  if (provider === "openrouter") loadOpenRouterModels(stored);
}

/** Filter OpenRouter's /models payload to truly-free models, CJK-capable first (pure). */
function freeOpenRouterModels(list) {
  const isFree = (m) => m && m.pricing &&
    Number(m.pricing.prompt) === 0 && Number(m.pricing.completion) === 0;
  // keep only models that output text (drops free audio/image-gen models)
  const isText = (m) => {
    const out = m.architecture && m.architecture.output_modalities;
    return !out || out.indexOf("text") >= 0;
  };
  const rank = (id) => (/deepseek|qwen|gemini|gemma|yi|glm|minimax/i.test(id) ? 0 : 1);
  return (list || []).filter((m) => isFree(m) && isText(m)).sort((a, b) => {
    const r = rank(a.id) - rank(b.id);
    return r !== 0 ? r : (a.id < b.id ? -1 : 1);
  });
}

/** Fetch the live free-model list from OpenRouter and repopulate the dropdown.
 *  Falls back silently to the static list on any failure. */
async function loadOpenRouterModels(stored) {
  try {
    const resp = await fetch("https://openrouter.ai/api/v1/models");
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    const data = await resp.json();
    const free = freeOpenRouterModels(data.data);
    if (!free.length) return;
    fillModelSelect(free.map((m) => [m.id, (m.name || m.id) + "（免费）"]), stored);
  } catch (e) {
    console.warn("OpenRouter model list fetch failed; using static list:", e);
  }
}

function loadApiSettings() {
  const provider = localStorage.getItem(PROVIDER_KEY) || DEFAULT_PROVIDER;
  $("#api-provider").value = provider;
  $("#api-key").value = localStorage.getItem(keyKey(provider)) || "";
  populateModels(provider);
  $("#api-note").textContent = NOTES[provider];
}

$("#api-provider").addEventListener("change", () => {
  const p = $("#api-provider").value;
  $("#api-key").value = localStorage.getItem(keyKey(p)) || "";
  populateModels(p);
  $("#api-note").textContent = NOTES[p];
});

$("#btn-save-api").addEventListener("click", () => {
  const p = $("#api-provider").value;
  localStorage.setItem(PROVIDER_KEY, p);
  const key = $("#api-key").value.trim();
  if (key) localStorage.setItem(keyKey(p), key);
  else localStorage.removeItem(keyKey(p));
  localStorage.setItem(modelKey(p), $("#api-model").value || DEFAULT_MODELS[p]);
  $("#btn-save-api").textContent = "✓ 已保存";
  setTimeout(() => { $("#btn-save-api").textContent = "保存设置"; }, 1500);
});

/* ---- TTS settings (VOICEVOX url / speaker / speed) ---- */
function loadTtsSettings() {
  $("#tts-voicevox-url").value = localStorage.getItem(TTS_VOICEVOX_URL_KEY) || "";
  const rate = ttsRate();
  $("#tts-rate").value = rate;
  $("#tts-rate-val").textContent = rate.toFixed(2) + "×";
  loadVoicevoxSpeakers();
}
$("#tts-rate").addEventListener("input", () => {
  $("#tts-rate-val").textContent = Number($("#tts-rate").value).toFixed(2) + "×";
});
$("#btn-tts-local").addEventListener("click", () => {
  $("#tts-voicevox-url").value = LOCAL_VOICEVOX;
  loadVoicevoxSpeakers();
});
$("#tts-voicevox-url").addEventListener("change", loadVoicevoxSpeakers);

/** Load VOICEVOX speaker list from the URL in the field; note the status. */
async function loadVoicevoxSpeakers() {
  const sel = $("#tts-speaker"), note = $("#tts-note");
  const fallback = jaVoice ? jaVoice.name : "（无日语系统语音）";
  const base = ($("#tts-voicevox-url").value || "").trim().replace(/\/+$/, "");
  if (!base) {
    sel.innerHTML = '<option value="">（未启用）</option>';
    note.textContent = "未填写 VOICEVOX 地址 → 使用系统语音：" + fallback + "。本地运行了 VOICEVOX 就点上面「用本地引擎」。";
    return;
  }
  try {
    const resp = await fetch(base + "/speakers", { cache: "no-store" });
    if (!resp.ok) throw new Error();
    const speakers = await resp.json();
    const stored = localStorage.getItem(TTS_SPEAKER_KEY) || DEFAULT_SPEAKER;
    sel.innerHTML = "";
    speakers.forEach((sp) => sp.styles.forEach((st) => {
      const o = document.createElement("option");
      o.value = st.id; o.textContent = sp.name + " / " + st.name;
      if (String(st.id) === String(stored)) o.selected = true;
      sel.appendChild(o);
    }));
    note.textContent = "✓ 已连接 VOICEVOX。不可用时回退系统语音：" + fallback;
  } catch (_) {
    sel.innerHTML = '<option value="">连接失败（将用系统语音）</option>';
    note.textContent = "无法连接 " + base + " —— 引擎是否在运行？（HTTPS 页面访问本地 http 引擎可能被浏览器限制。）当前用系统语音：" + fallback;
  }
}

$("#btn-save-tts").addEventListener("click", () => {
  localStorage.setItem(TTS_VOICEVOX_URL_KEY, ($("#tts-voicevox-url").value || "").trim());
  const spk = $("#tts-speaker").value;
  if (spk) localStorage.setItem(TTS_SPEAKER_KEY, spk);
  localStorage.setItem(TTS_RATE_KEY, $("#tts-rate").value);
  $("#btn-save-tts").textContent = "✓ 已保存";
  setTimeout(() => { $("#btn-save-tts").textContent = "保存朗读设置"; }, 1500);
});

/** The lookup instruction shared by every provider. */
const SYSTEM_PROMPT =
  "你是给中文母语者用的日语词典。用户给你一个词，它可能是日语汉字原文，" +
  "也可能是学习者按中文读音/中文写法记下的、对应某个日语词。" +
  "请判断用户想查的日语词，并给出：标准日语写法(phrase)、平假名读音(kana)、" +
  "罗马音(romaji)、简体中文意思(meaning_zh)、若该词容易被中文读法误解则给出提示(trap_zh，否则空字符串)、" +
  "一个使用该词的日语例句(example)、例句的假名读音(example_kana)、例句的中文翻译(example_zh)。" +
  "只输出一个 JSON 对象本身，不要使用代码块标记(```)、不要任何解释或多余文字。" +
  "所有字段都要填（trap_zh 可为空字符串）。";

const FIELDS = ["phrase", "kana", "romaji", "meaning_zh", "trap_zh", "example", "example_kana", "example_zh"];

/** Anthropic Messages API request body (pure). */
function claudeRequestBody(word, model) {
  const props = {};
  for (const f of FIELDS) props[f] = { type: "string" };
  return {
    model: model || DEFAULT_MODELS.anthropic,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: "要查的词：" + word }],
    output_config: {
      format: { type: "json_schema", schema: { type: "object", additionalProperties: false, properties: props, required: FIELDS } },
    },
  };
}

/** OpenAI-compatible chat request body — used by OpenRouter and DeepSeek (pure).
 *  No response_format: many models reject it; the prompt + tolerant parser
 *  (parseEntryJson strips prose / code-fences / <think>) handle JSON extraction. */
function openaiChatBody(word, model, fallbackModel) {
  return {
    model: model || fallbackModel,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: "要查的词：" + word },
    ],
  };
}

/** Google Gemini generateContent request body (pure). */
function geminiRequestBody(word) {
  const props = {};
  for (const f of FIELDS) props[f] = { type: "STRING" };
  return {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: "要查的词：" + word }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: { type: "OBJECT", properties: props, required: FIELDS, propertyOrdering: FIELDS },
    },
  };
}

/** Build the HTTP request (url/headers/body) for a provider (pure). */
function buildAIRequest(provider, word, model, key) {
  if (provider === "gemini") {
    return {
      url: "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: geminiRequestBody(word),
    };
  }
  if (provider === "openrouter") {
    return {
      url: "https://openrouter.ai/api/v1/chat/completions",
      headers: { "content-type": "application/json", authorization: "Bearer " + key },
      body: openaiChatBody(word, model, DEFAULT_MODELS.openrouter),
    };
  }
  if (provider === "deepseek") {
    return {
      url: "https://api.deepseek.com/chat/completions",
      headers: { "content-type": "application/json", authorization: "Bearer " + key },
      body: openaiChatBody(word, model, DEFAULT_MODELS.deepseek),
    };
  }
  return {
    url: "https://api.anthropic.com/v1/messages",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: claudeRequestBody(word, model),
  };
}

/** Pull the model's text output from a provider response (pure). */
function extractAIText(provider, data) {
  if (provider === "gemini") {
    const parts = (data && data.candidates && data.candidates[0] &&
      data.candidates[0].content && data.candidates[0].content.parts) || [];
    return parts.map((p) => p.text || "").join("");
  }
  if (provider === "openrouter" || provider === "deepseek") {
    return (data && data.choices && data.choices[0] &&
      data.choices[0].message && data.choices[0].message.content) || "";
  }
  return (data && data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
}

/** Parse a provider's text response into a normalized entry (pure). */
function parseEntryJson(text) {
  if (!text) return null;
  // strip code fences and reasoning-model <think> blocks before extracting
  const cleaned = String(text)
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```(?:json)?/gi, "")
    .trim();
  let obj = null;
  try { obj = JSON.parse(cleaned); }
  catch (_) {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) { try { obj = JSON.parse(m[0]); } catch (_) {} }
  }
  if (!obj || typeof obj !== "object" || !obj.phrase) return null;
  const s = (v) => (v == null ? "" : String(v));
  return {
    phrase: s(obj.phrase),
    kana: s(obj.kana),
    romaji: s(obj.romaji) || kanaToRomaji(s(obj.kana)),
    meaning_zh: s(obj.meaning_zh),
    trap_zh: s(obj.trap_zh),
    example: s(obj.example),
    example_kana: s(obj.example_kana),
    example_zh: s(obj.example_zh),
    source: "claude",
  };
}

/** Extract a human-readable error from a provider error payload (pure). */
function extractApiError(data) {
  const e = data && data.error;
  if (!e) return "";
  let msg = e.message || (e.code != null ? String(e.code) : "未知错误");
  if (e.code != null && String(e.code) !== msg) msg += "（" + e.code + "）";
  const md = e.metadata;
  if (md) {
    if (md.provider_name) msg += " · " + md.provider_name;
    if (md.raw) {
      const raw = typeof md.raw === "string" ? md.raw : JSON.stringify(md.raw);
      msg += "：" + raw.slice(0, 200);
    }
  }
  return msg;
}

function aiConfig() {
  const provider = localStorage.getItem(PROVIDER_KEY) || DEFAULT_PROVIDER;
  return {
    provider,
    key: localStorage.getItem(keyKey(provider)) || "",
    model: localStorage.getItem(modelKey(provider)) || DEFAULT_MODELS[provider],
  };
}

async function askAI(word) {
  word = (word || "").trim();
  if (!word) return;
  const { provider, key, model } = aiConfig();
  if (!key) {
    alert("请先在「添加」标签里配置 API Key（推荐免费的 Gemini）。");
    switchView("add");
    return;
  }

  $("#id-result").classList.remove("hidden");
  $("#id-heard-text").textContent = word;
  $("#id-found").classList.add("hidden");
  $("#id-notfound").classList.add("hidden");
  const loading = $("#id-loading");
  loading.textContent = "🤖 查询中…";
  loading.classList.remove("hidden");

  try {
    const req = buildAIRequest(provider, word, model, key);
    const resp = await fetch(req.url, {
      method: "POST",
      headers: req.headers,
      body: JSON.stringify(req.body),
    });
    if (!resp.ok) {
      let msg = "HTTP " + resp.status;
      try { msg = extractApiError(await resp.json()) || msg; } catch (_) {}
      throw new Error(msg);
    }
    const data = await resp.json();
    const entry = parseEntryJson(extractAIText(provider, data));
    if (!entry) throw new Error(extractApiError(data) || "无法解析返回结果");
    loading.classList.add("hidden");
    renderFound(entry);
  } catch (e) {
    const hint = provider === "openrouter" ? "（免费模型偶尔不稳定，可重试或在「添加」里换一个模型）" : "";
    loading.textContent = "查询失败：" + e.message + hint;
    $("#id-found").classList.add("hidden");
    $("#id-notfound").classList.add("hidden");
  }
}

/* ---------- Library ---------- */

function renderLibrary(filter) {
  const list = $("#lib-list");
  const q = (filter ?? $("#lib-search").value ?? "").trim().toLowerCase();
  const entries = allEntries().filter((e) => {
    if (!q) return true;
    return [e.phrase, e.kana, e.romaji, e.meaning_zh].some(
      (f) => (f || "").toLowerCase().includes(q)
    );
  });
  if (!entries.length) {
    list.innerHTML = `<div class="empty">没有匹配的词条。</div>`;
    return;
  }
  list.innerHTML = "";
  entries.forEach((e) => {
    const card = getCard(e.id);
    const stat = card.reps
      ? `复习 ${card.reps} 次` + (card.lastScore != null ? ` · ${card.lastScore}%` : "")
      : "未练习";
    const div = document.createElement("div");
    div.className = "lib-item";
    div.innerHTML = `
      <div class="li-main">
        <div class="li-phrase">${escapeHtml(e.phrase)}</div>
        <div class="li-kana">${escapeHtml(e.kana || "")} · ${escapeHtml(e.romaji || kanaToRomaji(e.kana || ""))}</div>
        <div class="li-meaning">${escapeHtml(e.meaning_zh || "")}</div>
      </div>
      <div class="li-stat">${stat}</div>
      <button class="li-play" title="播放">🔊</button>`;
    div.querySelector(".li-play").addEventListener("click", () => speak(e.phrase, e.kana));
    list.appendChild(div);
  });
}
$("#lib-search").addEventListener("input", () => renderLibrary());

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------- Add form ---------- */

function slugify(phrase, kana) {
  const base = kanaToRomaji(kana || "") || phrase;
  return base.replace(/[^a-z0-9]/gi, "").toLowerCase() || ("e" + Date.now());
}

$("#add-form").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const fd = new FormData(ev.target);
  const phrase = (fd.get("phrase") || "").trim();
  if (!phrase) return;
  const kana = (fd.get("kana") || "").trim();
  const entry = {
    id: slugify(phrase, kana),
    phrase,
    kana,
    romaji: (fd.get("romaji") || "").trim() || kanaToRomaji(kana),
    meaning_zh: (fd.get("meaning_zh") || "").trim(),
    trap_zh: (fd.get("trap_zh") || "").trim(),
    example: (fd.get("example") || "").trim(),
    example_kana: (fd.get("example_kana") || "").trim(),
    example_zh: (fd.get("example_zh") || "").trim(),
  };
  const { userEntries } = loadState();
  const idx = userEntries.findIndex((e) => e.id === entry.id);
  if (idx >= 0) userEntries[idx] = entry; else userEntries.push(entry);
  saveUserEntries(userEntries);
  ev.target.reset();
  alert(`已加入：${entry.phrase}（${entry.kana || entry.romaji}）`);
  switchView("library");
});

$("#btn-export").addEventListener("click", () => {
  const data = JSON.stringify(allEntries(), null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "hatsuon-library.json";
  a.click();
  URL.revokeObjectURL(a.href);
});

$("#btn-import").addEventListener("click", () => $("#import-file").click());
$("#import-file").addEventListener("change", (ev) => {
  const file = ev.target.files && ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const arr = JSON.parse(reader.result);
      if (!Array.isArray(arr)) throw new Error("文件格式不对（应为词条数组）");
      const { userEntries } = loadState();
      const { list, added } = mergeEntries(userEntries, arr);
      if (saveUserEntries(list)) {
        alert(`已导入 ${arr.length} 条，其中新增 ${added} 条。`);
        renderLibrary();
      }
    } catch (e) {
      alert("导入失败：" + e.message);
    }
  };
  reader.onerror = () => alert("读取文件失败。");
  reader.readAsText(file);
  ev.target.value = ""; // allow re-importing the same file
});

$("#btn-reset-progress").addEventListener("click", () => {
  if (confirm("确定清空所有练习进度？（词库本身不会删除）")) {
    saveProgress({});
    alert("进度已重置。");
  }
});

/* ---------------- boot ---------------- */
switchView("practice");
