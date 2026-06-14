/* Headless smoke-test for app.js logic under jsc (no DOM).
 * Stubs just enough of window/document/localStorage so app.js loads,
 * then exercises the pure logic: kana normalization, similarity grading,
 * romaji conversion, speech grading, and the SM-2 scheduler. */
"use strict";

/* ---- minimal browser stubs ---- */
const elProxy = new Proxy(function () {}, {
  get(_t, prop) {
    if (prop === "classList")
      return { add() {}, remove() {}, toggle() {}, contains() { return false; } };
    if (prop === "style") return {};
    if (prop === "dataset") return {};
    if (prop === "value") return "";
    if (prop === "textContent" || prop === "innerHTML") return "";
    if (prop === "appendChild" || prop === "addEventListener" ||
        prop === "removeEventListener" || prop === "reset" || prop === "click")
      return function () {};
    if (prop === "querySelector") return () => elProxy;
    if (prop === "querySelectorAll") return () => [];
    return elProxy;
  },
  set() { return true; },
  apply() { return elProxy; },
});

const _ls = {};
globalThis.localStorage = {
  getItem: (k) => (k in _ls ? _ls[k] : null),
  setItem: (k, v) => { _ls[k] = String(v); },
  removeItem: (k) => { delete _ls[k]; },
};
globalThis.window = globalThis;
globalThis.document = {
  querySelector: () => elProxy,
  querySelectorAll: () => [],
  createElement: () => elProxy,
};
globalThis.alert = () => {};
globalThis.confirm = () => false;
globalThis.navigator = { clipboard: { writeText: () => ({ then() {} }) } };
globalThis.SpeechRecognition = undefined;
globalThis.webkitSpeechRecognition = undefined;
globalThis.URL = { createObjectURL: () => "", revokeObjectURL: () => {} };
globalThis.Blob = function () {};
globalThis.FormData = function () {};

/* ---- load the real files ---- */
load("/Users/wenbaoli/Documents/Github/jp-pronounce/library.js");
load("/Users/wenbaoli/Documents/Github/jp-pronounce/dict.js");
load("/Users/wenbaoli/Documents/Github/jp-pronounce/app.js");

/* ---- assertions ---- */
let pass = 0, fail = 0;
function eq(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  (ok ? pass++ : fail++);
  print(`${ok ? "PASS" : "FAIL"}  ${name}` + (ok ? "" : `  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`));
}
function approx(name, got, want, tol) {
  const ok = Math.abs(got - want) <= tol;
  (ok ? pass++ : fail++);
  print(`${ok ? "PASS" : "FAIL"}  ${name}` + (ok ? "" : `  got=${got} want≈${want}`));
}
function truthy(name, got) {
  const ok = !!got; (ok ? pass++ : fail++);
  print(`${ok ? "PASS" : "FAIL"}  ${name}` + (ok ? "" : `  got=${JSON.stringify(got)}`));
}

/* library loaded */
eq("seed library size", window.SEED_LIBRARY.length, 6);
eq("allEntries dedup", allEntries().length, 6);

/* kana normalization: katakana -> hiragana, strip marks */
eq("normalize katakana->hiragana", normalizeKana("ベンキョウ"), "べんきょう");
eq("normalize strips long mark", normalizeKana("コーヒー"), "こひ");

/* romaji conversion of seed kana */
eq("romaji benkyou", kanaToRomaji("べんきょう"), "benkyou");
eq("romaji kitte (sokuon)", kanaToRomaji("きって"), "kitte");
eq("romaji jama (youon)", kanaToRomaji("じゃま"), "jama");
eq("romaji tegami", kanaToRomaji("てがみ"), "tegami");

/* similarity */
approx("similarity identical", similarity("benkyou","benkyou"), 1, 0.001);
truthy("similarity partial < 1", similarity("benkyou","benko") < 1 && similarity("benkyou","benko") > 0.4);

/* speech grading: exact kana match = 100 */
const e = window.SEED_LIBRARY[0]; // 勉強 / べんきょう
eq("grade exact kana", gradeSpeech("べんきょう", e).score, 100);
eq("grade exact kanji", gradeSpeech("勉強", e).score, 100);
truthy("grade wrong is low", gradeSpeech("ありがとう", e).score < 50);

/* SM-2 scheduler */
saveProgress({});
reviewCard(e.id, "good");
let c = getCard(e.id);
eq("sm2 reps after good", c.reps, 1);
eq("sm2 interval after first good", c.interval, 1);
truthy("sm2 due set in future", c.due > 0);
reviewCard(e.id, "good");
c = getCard(e.id);
eq("sm2 reps after 2nd good", c.reps, 2);
eq("sm2 interval after 2nd good", c.interval, 3);
reviewCard(e.id, "again");
c = getCard(e.id);
eq("sm2 reset on again", c.reps, 0);
eq("sm2 interval reset on again", c.interval, 0);

/* lastScore recorded */
reviewCard(e.id, "good", 87);
eq("sm2 records speech score", getCard(e.id).lastScore, 87);

/* ---- Identify: dictionary lookup ---- */
truthy("dictionary loaded", window.DICTIONARY.length > 50);

// every entry well-formed
let dictOk = true;
for (const d of window.DICTIONARY) {
  if (!d.phrase || !d.kana || !d.romaji || !d.meaning_zh) { dictOk = false; print("  bad dict entry: " + JSON.stringify(d)); }
}
truthy("every dict entry has phrase/kana/romaji/meaning", dictOk);

// lookup by Japanese form (phrase key)
eq("lookup 学習 (phrase)", lookupWord("学習") && lookupWord("学習").kana, "がくしゅう");
// lookup by simplified-Chinese form (zh key) — what zh-CN recognizer returns
eq("lookup 学习 (simplified)", lookupWord("学习") && lookupWord("学习").phrase, "学習");
eq("lookup 经济 (simplified)", lookupWord("经济") && lookupWord("经济").phrase, "経済");
// classic trap word via simplified
eq("lookup 手纸 (trap)", lookupWord("手纸") && lookupWord("手纸").phrase, "手紙");
// learned simplified->Japanese char map
eq("toJaKanji 经济", toJaKanji("经济"), "経済");
eq("toJaKanji 济 char", toJaKanji("済"), "済");
// whitespace tolerated
eq("lookup with spaces", lookupWord(" 学 习 ") && lookupWord(" 学 习 ").phrase, "学習");
// unknown word -> null
eq("lookup unknown -> null", lookupWord("你好吗"), null);

// inLibrary reflects seed library, not dictionary
eq("inLibrary seed word", inLibrary("勉強"), true);
eq("inLibrary dict-only word", inLibrary("学習"), false);

/* ---- JMdict fallback lookup (pure core, fixture map) ---- */
const JM = {
  "学習": ["がくしゅう", "learning; study"],
  "学习": ["がくしゅう", "learning; study", "学習"],
  "経済": ["けいざい", "economy; economics"],
};
eq("jmdict primary (JP key)", jmdictLookupIn(JM, "学習") && jmdictLookupIn(JM, "学習").kana, "がくしゅう");
eq("jmdict alias shows JP headword", jmdictLookupIn(JM, "学习") && jmdictLookupIn(JM, "学习").phrase, "学習");
eq("jmdict alias meaning (english)", jmdictLookupIn(JM, "学习") && jmdictLookupIn(JM, "学习").meaning_zh, "learning; study");
eq("jmdict source tag", jmdictLookupIn(JM, "学習") && jmdictLookupIn(JM, "学習").source, "jmdict");
// simplified not a key, but toJaKanji (learned from dict.js) normalizes 经济 -> 経済
eq("jmdict via toJaKanji normalize", jmdictLookupIn(JM, "经济") && jmdictLookupIn(JM, "经济").phrase, "経済");
eq("jmdict miss -> null", jmdictLookupIn(JM, "你好吗"), null);
eq("jmdict no map -> null", jmdictLookupIn(null, "学習"), null);

print(`\n${pass} passed, ${fail} failed`);
if (fail) throw new Error("tests failed");
