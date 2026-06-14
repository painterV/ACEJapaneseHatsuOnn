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

function saveUserEntries(list) {
  localStorage.setItem(STORE_KEY, JSON.stringify(list));
}
function saveProgress(p) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
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

/* ---------- TTS ---------- */

let jaVoice = null;
function pickVoice() {
  const voices = speechSynthesis.getVoices();
  jaVoice = voices.find((v) => /ja[-_]JP/i.test(v.lang)) ||
            voices.find((v) => /^ja/i.test(v.lang)) || null;
}
if ("speechSynthesis" in window) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}
/** Speak Japanese; prefer kana (more reliable pronunciation) if present. */
function speak(phrase, kana) {
  if (!("speechSynthesis" in window)) { alert("此浏览器不支持语音播放。"); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(kana || phrase);
  u.lang = "ja-JP";
  if (jaVoice) u.voice = jaVoice;
  u.rate = 0.9;
  speechSynthesis.speak(u);
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
  const btn = $("#btn-id-mic");
  if (!recognizing) btn.textContent = "🎤 用中文读音说一个词";
}

$("#btn-id-mic").addEventListener("click", () => {
  $("#id-result").classList.add("hidden");
  $("#id-listening").classList.remove("hidden");
  recognize({
    lang: "zh-CN",
    alternatives: 6,
    onResult: (alts) => { $("#id-listening").classList.add("hidden"); showIdentifyResult(alts); },
    onError: (err) => { $("#id-listening").classList.add("hidden"); showIdentifyResult([], err); },
    btn: $("#btn-id-mic"),
    listeningLabel: "🎤 听着…",
    idleLabel: "🎤 用中文读音说一个词",
  });
});

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

  const found = $("#id-found"), notfound = $("#id-notfound");
  if (hit) {
    identified = hit;
    found.classList.remove("hidden");
    notfound.classList.add("hidden");
    $("#id-phrase").textContent = hit.phrase;
    $("#id-kana").textContent = hit.kana || "";
    $("#id-romaji").textContent = hit.romaji || kanaToRomaji(hit.kana || "");
    $("#id-meaning").textContent = hit.meaning_zh || "";
    const src = $("#id-source");
    if (hit.source === "jmdict") { src.textContent = "英文释义 · JMdict"; src.classList.remove("hidden"); }
    else src.classList.add("hidden");
    const trap = $("#id-trap");
    if (hit.trap_zh) { trap.textContent = "⚠️ " + hit.trap_zh; trap.classList.remove("hidden"); }
    else trap.classList.add("hidden");
    const already = inLibrary(hit.phrase);
    $("#id-inlib").classList.toggle("hidden", !already);
    $("#id-add").classList.toggle("hidden", already);
    speak(hit.phrase, hit.kana); // auto-play the correct pronunciation
  } else {
    identified = null;
    found.classList.add("hidden");
    notfound.classList.remove("hidden");
    $("#id-nf-word").textContent = heard || "（未识别）";
  }
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

$("#btn-reset-progress").addEventListener("click", () => {
  if (confirm("确定清空所有练习进度？（词库本身不会删除）")) {
    saveProgress({});
    alert("进度已重置。");
  }
});

/* ---------------- boot ---------------- */
switchView("practice");
