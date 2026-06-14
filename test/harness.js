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

/* ---- Claude API: request body + response parsing (pure) ---- */
const body = claudeRequestBody("勉強");
eq("claude body default model", body.model, "claude-opus-4-8");
eq("claude body max_tokens", body.max_tokens, 1024);
eq("claude body format type", body.output_config.format.type, "json_schema");
eq("claude body user role", body.messages[0].role, "user");
truthy("claude body system is string", typeof body.system === "string" && body.system.length > 10);
eq("claude body model override", claudeRequestBody("x", "claude-haiku-4-5").model, "claude-haiku-4-5");

const clean = JSON.stringify({
  phrase: "紹介", kana: "しょうかい", romaji: "shōkai", meaning_zh: "介绍",
  trap_zh: "", example: "友達を紹介します。", example_kana: "ともだちをしょうかいします。", example_zh: "介绍朋友。",
});
eq("parse clean json phrase", parseEntryJson(clean).phrase, "紹介");
eq("parse clean json source", parseEntryJson(clean).source, "claude");
eq("parse clean json example", parseEntryJson(clean).example_zh, "介绍朋友。");
// tolerant of surrounding prose / code fences
eq("parse fenced json", parseEntryJson("```json\n" + clean + "\n```").phrase, "紹介");
eq("parse with preamble", parseEntryJson("好的，结果如下：" + clean).kana, "しょうかい");
// reasoning-model output: <think> … </think> then JSON
eq("parse strips think block", parseEntryJson("<think>用户想查 {紹介}…</think>\n" + clean).phrase, "紹介");
// derives romaji from kana when missing
eq("parse derives romaji", parseEntryJson(JSON.stringify({ phrase: "切手", kana: "きって" })).romaji, "kitte");
// garbage / missing phrase -> null
eq("parse garbage -> null", parseEntryJson("not json at all"), null);
eq("parse no phrase -> null", parseEntryJson(JSON.stringify({ kana: "あ" })), null);
eq("parse empty -> null", parseEntryJson(""), null);

/* ---- Gemini provider: request body, request builder, text extraction ---- */
const gbody = geminiRequestBody("勉強");
eq("gemini mime", gbody.generationConfig.responseMimeType, "application/json");
eq("gemini user role", gbody.contents[0].role, "user");
eq("gemini schema required count", gbody.generationConfig.responseSchema.required.length, 8);
truthy("gemini system instruction", typeof gbody.systemInstruction.parts[0].text === "string");

const gReq = buildAIRequest("gemini", "学習", "gemini-2.0-flash", "KEY123");
truthy("gemini url has model", gReq.url.indexOf("gemini-2.0-flash:generateContent") > 0);
eq("gemini auth header", gReq.headers["x-goog-api-key"], "KEY123");
const aReq = buildAIRequest("anthropic", "学習", "claude-opus-4-8", "KEY123");
eq("anthropic url", aReq.url, "https://api.anthropic.com/v1/messages");
eq("anthropic auth header", aReq.headers["x-api-key"], "KEY123");

eq("extract gemini text", extractAIText("gemini", { candidates: [{ content: { parts: [{ text: '{"x":1}' }] } }] }), '{"x":1}');
eq("extract anthropic text", extractAIText("anthropic", { content: [{ type: "text", text: "hi" }, { type: "tool_use" }] }), "hi");
eq("extract gemini empty", extractAIText("gemini", {}), "");

/* ---- OpenAI-compatible providers: OpenRouter + DeepSeek ---- */
const orBody = openaiChatBody("勉強", "some-model", "fallback");
eq("openai body model", orBody.model, "some-model");
eq("openai body fallback", openaiChatBody("x", "", "fb").model, "fb");
eq("openai system msg", orBody.messages[0].role, "system");
eq("openai user msg", orBody.messages[1].role, "user");
truthy("openai no response_format", orBody.response_format === undefined);

const orReq = buildAIRequest("openrouter", "学習", "qwen/qwen3:free", "KEY9");
eq("openrouter url", orReq.url, "https://openrouter.ai/api/v1/chat/completions");
eq("openrouter auth bearer", orReq.headers.authorization, "Bearer KEY9");
const dsReq = buildAIRequest("deepseek", "学習", "deepseek-chat", "KEY8");
eq("deepseek url", dsReq.url, "https://api.deepseek.com/chat/completions");
eq("deepseek auth bearer", dsReq.headers.authorization, "Bearer KEY8");
eq("deepseek body model", dsReq.body.model, "deepseek-chat");

eq("extract openrouter text", extractAIText("openrouter", { choices: [{ message: { content: '{"y":2}' } }] }), '{"y":2}');
eq("extract deepseek text", extractAIText("deepseek", { choices: [{ message: { content: '{"z":3}' } }] }), '{"z":3}');
eq("extract openrouter empty", extractAIText("openrouter", {}), "");

/* ---- API error extraction (pure) ---- */
truthy("apierr basic", extractApiError({ error: { message: "Provider returned error" } }).indexOf("Provider returned error") === 0);
truthy("apierr with code", extractApiError({ error: { message: "rate limited", code: 429 } }).indexOf("429") >= 0);
truthy("apierr with provider", extractApiError({ error: { message: "x", metadata: { provider_name: "Chutes" } } }).indexOf("Chutes") >= 0);
truthy("apierr with raw", extractApiError({ error: { message: "x", metadata: { raw: "upstream 502" } } }).indexOf("upstream 502") >= 0);
eq("apierr none", extractApiError({}), "");

/* ---- OpenRouter free-model filtering (pure) ---- */
const orModels = [
  { id: "anthropic/claude-x", pricing: { prompt: "0.000003", completion: "0.000015" } },
  { id: "deepseek/deepseek-chat:free", pricing: { prompt: "0", completion: "0" } },
  { id: "meta-llama/llama-3.3-70b:free", pricing: { prompt: "0", completion: "0" } },
  { id: "qwen/qwen-2.5-72b:free", pricing: { prompt: "0", completion: "0" } },
  { id: "some/audio-model:free", pricing: { prompt: "0", completion: "0" }, architecture: { output_modalities: ["audio"] } },
  { id: "no-pricing-model" },
];
const orFree = freeOpenRouterModels(orModels);
eq("free filter drops paid + malformed + audio", orFree.length, 3);
truthy("free filter cjk first", /deepseek|qwen/.test(orFree[0].id));
eq("free filter drops audio", orFree.filter((m) => m.id.indexOf("audio") >= 0).length, 0);
eq("free filter excludes paid", orFree.filter((m) => m.id.indexOf("claude") >= 0).length, 0);

/* ---- import merge (pure) ---- */
const mEx = [{ id: "a", phrase: "亜" }, { id: "b", phrase: "井" }];
const mIn = [{ id: "b", phrase: "井NEW" }, { id: "c", phrase: "宇" }, { bad: 1 }];
const merged = mergeEntries(mEx, mIn);
eq("merge added count", merged.added, 1); // only 'c' is new ('b' updates, bad skipped)
eq("merge total size", merged.list.length, 3);
eq("merge updates existing", merged.list.find((e) => e.id === "b").phrase, "井NEW");
eq("merge skips invalid", merged.list.filter((e) => !e.id).length, 0);
eq("merge empty incoming", mergeEntries(mEx, []).list.length, 2);

print(`\n${pass} passed, ${fail} failed`);
if (fail) throw new Error("tests failed");
