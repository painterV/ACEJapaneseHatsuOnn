/*
 * Practice library — the single source of truth for phrases.
 *
 * Each entry is appended here (by Claude, in chat, or by you via the "Add" tab).
 * The app reads this list, merges it into your local progress, and never loses
 * your scores when new entries are added (entries are matched by `id`).
 *
 * Entry shape:
 *   {
 *     id:          unique slug (romaji, no spaces)        e.g. "benkyou"
 *     phrase:      original Japanese (kanji / kanji+kana) e.g. "勉強"
 *     kana:        hiragana reading                       e.g. "べんきょう"
 *     romaji:      romanized reading                      e.g. "benkyō"
 *     meaning_zh:  Chinese meaning                        e.g. "学习"
 *     trap_zh:     (optional) the misleading Chinese reading/meaning to warn about
 *     example:     example sentence in Japanese
 *     example_kana:reading of the example (hiragana)
 *     example_zh:  Chinese translation of the example
 *   }
 */
window.SEED_LIBRARY = [
  {
    id: "benkyou",
    phrase: "勉強",
    kana: "べんきょう",
    romaji: "benkyō",
    meaning_zh: "学习",
    trap_zh: "中文「勉强」=不情愿，日语却是「学习」",
    example: "毎日日本語を勉強します。",
    example_kana: "まいにちにほんごをべんきょうします。",
    example_zh: "我每天学习日语。"
  },
  {
    id: "tegami",
    phrase: "手紙",
    kana: "てがみ",
    romaji: "tegami",
    meaning_zh: "信（书信）",
    trap_zh: "中文「手纸」=厕纸，日语却是「书信」",
    example: "母に手紙を書きました。",
    example_kana: "ははにてがみをかきました。",
    example_zh: "我给妈妈写了一封信。"
  },
  {
    id: "daijoubu",
    phrase: "大丈夫",
    kana: "だいじょうぶ",
    romaji: "daijōbu",
    meaning_zh: "没关系／不要紧",
    trap_zh: "",
    example: "怪我は大丈夫ですか。",
    example_kana: "けがはだいじょうぶですか。",
    example_zh: "你的伤不要紧吧？"
  },
  {
    id: "kitte",
    phrase: "切手",
    kana: "きって",
    romaji: "kitte",
    meaning_zh: "邮票",
    trap_zh: "",
    example: "封筒に切手を貼ります。",
    example_kana: "ふうとうにきってをはります。",
    example_zh: "在信封上贴邮票。"
  },
  {
    id: "yakusoku",
    phrase: "約束",
    kana: "やくそく",
    romaji: "yakusoku",
    meaning_zh: "约定／约会",
    trap_zh: "",
    example: "友達と会う約束をしました。",
    example_kana: "ともだちとあうやくそくをしました。",
    example_zh: "我和朋友约好了见面。"
  },
  {
    id: "jama",
    phrase: "邪魔",
    kana: "じゃま",
    romaji: "jama",
    meaning_zh: "打扰／妨碍",
    trap_zh: "",
    example: "お邪魔します。",
    example_kana: "おじゃまします。",
    example_zh: "打扰了（进门时的寒暄）。"
  }
];
