/*
 * Lookup dictionary for the 识别 (Identify) tab.
 *
 * Flow: you say a Japanese word using its Chinese reading → zh-CN speech
 * recognition transcribes the kanji (usually in *simplified* Chinese) → we look
 * the word up here to recover the correct Japanese reading + meaning.
 *
 * Entry shape:
 *   phrase     Japanese form (kanji / kanji+kana)     "学習"
 *   zh         the simplified-Chinese form the recognizer most likely returns
 *              (so 学習 is found when you say 学习). Omit if identical to phrase.
 *   kana       hiragana reading                        "がくしゅう"
 *   romaji     romanized reading                       "gakushū"
 *   meaning_zh Chinese meaning
 *   trap_zh    (optional) warning when the Chinese reading/meaning misleads
 *
 * Curated common-word set — extend freely (ask Claude to add more).
 */
window.DICTIONARY = [
  /* ---- study / school ---- */
  { phrase: "学習", zh: "学习", kana: "がくしゅう", romaji: "gakushū", meaning_zh: "学习" },
  { phrase: "勉強", zh: "勉强", kana: "べんきょう", romaji: "benkyō", meaning_zh: "学习、用功", trap_zh: "中文「勉强」=不情愿" },
  { phrase: "学校", zh: "学校", kana: "がっこう", romaji: "gakkō", meaning_zh: "学校" },
  { phrase: "先生", zh: "先生", kana: "せんせい", romaji: "sensei", meaning_zh: "老师", trap_zh: "中文「先生」=Mr./丈夫，日语指「老师」" },
  { phrase: "学生", zh: "学生", kana: "がくせい", romaji: "gakusei", meaning_zh: "学生" },
  { phrase: "質問", zh: "质问", kana: "しつもん", romaji: "shitsumon", meaning_zh: "提问、问题", trap_zh: "中文「质问」语气强，日语只是「提问」" },
  { phrase: "宿題", zh: "宿题", kana: "しゅくだい", romaji: "shukudai", meaning_zh: "作业" },
  { phrase: "試験", zh: "试验", kana: "しけん", romaji: "shiken", meaning_zh: "考试", trap_zh: "中文「试验」=experiment，日语多指「考试」" },
  { phrase: "練習", zh: "练习", kana: "れんしゅう", romaji: "renshū", meaning_zh: "练习" },
  { phrase: "授業", zh: "授业", kana: "じゅぎょう", romaji: "jugyō", meaning_zh: "课、上课" },
  { phrase: "図書館", zh: "图书馆", kana: "としょかん", romaji: "toshokan", meaning_zh: "图书馆" },
  { phrase: "教室", zh: "教室", kana: "きょうしつ", romaji: "kyōshitsu", meaning_zh: "教室" },
  { phrase: "大学", zh: "大学", kana: "だいがく", romaji: "daigaku", meaning_zh: "大学" },
  { phrase: "言葉", zh: "言叶", kana: "ことば", romaji: "kotoba", meaning_zh: "词语、语言" },
  { phrase: "意味", zh: "意味", kana: "いみ", romaji: "imi", meaning_zh: "意思、含义", trap_zh: "中文「意味」≠日语，日语指「意思」" },

  /* ---- places ---- */
  { phrase: "銀行", zh: "银行", kana: "ぎんこう", romaji: "ginkō", meaning_zh: "银行" },
  { phrase: "病院", zh: "病院", kana: "びょういん", romaji: "byōin", meaning_zh: "医院" },
  { phrase: "会社", zh: "会社", kana: "かいしゃ", romaji: "kaisha", meaning_zh: "公司", trap_zh: "日语「会社」=公司，不是「协会」" },
  { phrase: "駅", zh: "驿", kana: "えき", romaji: "eki", meaning_zh: "车站" },
  { phrase: "空港", zh: "空港", kana: "くうこう", romaji: "kūkō", meaning_zh: "机场" },
  { phrase: "郵便局", zh: "邮便局", kana: "ゆうびんきょく", romaji: "yūbinkyoku", meaning_zh: "邮局" },
  { phrase: "本屋", zh: "本屋", kana: "ほんや", romaji: "hon'ya", meaning_zh: "书店" },
  { phrase: "食堂", zh: "食堂", kana: "しょくどう", romaji: "shokudō", meaning_zh: "食堂" },
  { phrase: "公園", zh: "公园", kana: "こうえん", romaji: "kōen", meaning_zh: "公园" },
  { phrase: "映画館", zh: "映画馆", kana: "えいがかん", romaji: "eigakan", meaning_zh: "电影院" },
  { phrase: "喫茶店", zh: "喫茶店", kana: "きっさてん", romaji: "kissaten", meaning_zh: "咖啡馆" },

  /* ---- time ---- */
  { phrase: "時間", zh: "时间", kana: "じかん", romaji: "jikan", meaning_zh: "时间" },
  { phrase: "今日", zh: "今日", kana: "きょう", romaji: "kyō", meaning_zh: "今天" },
  { phrase: "明日", zh: "明日", kana: "あした", romaji: "ashita", meaning_zh: "明天" },
  { phrase: "昨日", zh: "昨日", kana: "きのう", romaji: "kinō", meaning_zh: "昨天" },
  { phrase: "毎日", zh: "每日", kana: "まいにち", romaji: "mainichi", meaning_zh: "每天" },
  { phrase: "週末", zh: "周末", kana: "しゅうまつ", romaji: "shūmatsu", meaning_zh: "周末" },
  { phrase: "午前", zh: "午前", kana: "ごぜん", romaji: "gozen", meaning_zh: "上午" },
  { phrase: "午後", zh: "午后", kana: "ごご", romaji: "gogo", meaning_zh: "下午" },
  { phrase: "季節", zh: "季节", kana: "きせつ", romaji: "kisetsu", meaning_zh: "季节" },
  { phrase: "誕生日", zh: "诞生日", kana: "たんじょうび", romaji: "tanjōbi", meaning_zh: "生日" },

  /* ---- people / family ---- */
  { phrase: "家族", zh: "家族", kana: "かぞく", romaji: "kazoku", meaning_zh: "家人、家庭", trap_zh: "日语「家族」=一家人，不是「家族势力」" },
  { phrase: "両親", zh: "两亲", kana: "りょうしん", romaji: "ryōshin", meaning_zh: "父母" },
  { phrase: "兄弟", zh: "兄弟", kana: "きょうだい", romaji: "kyōdai", meaning_zh: "兄弟姐妹" },
  { phrase: "息子", zh: "息子", kana: "むすこ", romaji: "musuko", meaning_zh: "儿子" },
  { phrase: "娘", zh: "娘", kana: "むすめ", romaji: "musume", meaning_zh: "女儿", trap_zh: "中文「娘」=母亲，日语却是「女儿」" },
  { phrase: "友達", zh: "友达", kana: "ともだち", romaji: "tomodachi", meaning_zh: "朋友" },
  { phrase: "彼女", zh: "彼女", kana: "かのじょ", romaji: "kanojo", meaning_zh: "她、女朋友" },
  { phrase: "彼氏", zh: "彼氏", kana: "かれし", romaji: "kareshi", meaning_zh: "男朋友" },
  { phrase: "恋人", zh: "恋人", kana: "こいびと", romaji: "koibito", meaning_zh: "恋人" },
  { phrase: "子供", zh: "子供", kana: "こども", romaji: "kodomo", meaning_zh: "孩子" },
  { phrase: "大人", zh: "大人", kana: "おとな", romaji: "otona", meaning_zh: "成年人", trap_zh: "中文「大人」=尊称，日语指「成年人」" },

  /* ---- everyday objects ---- */
  { phrase: "手紙", zh: "手纸", kana: "てがみ", romaji: "tegami", meaning_zh: "信", trap_zh: "中文「手纸」=厕纸，日语却是「书信」" },
  { phrase: "切手", zh: "切手", kana: "きって", romaji: "kitte", meaning_zh: "邮票" },
  { phrase: "新聞", zh: "新闻", kana: "しんぶん", romaji: "shinbun", meaning_zh: "报纸", trap_zh: "中文「新闻」=news，日语「新聞」=报纸" },
  { phrase: "雑誌", zh: "杂志", kana: "ざっし", romaji: "zasshi", meaning_zh: "杂志" },
  { phrase: "電話", zh: "电话", kana: "でんわ", romaji: "denwa", meaning_zh: "电话" },
  { phrase: "携帯", zh: "携带", kana: "けいたい", romaji: "keitai", meaning_zh: "手机", trap_zh: "中文「携带」=carry，日语口语指「手机」" },
  { phrase: "眼鏡", zh: "眼镜", kana: "めがね", romaji: "megane", meaning_zh: "眼镜" },
  { phrase: "財布", zh: "财布", kana: "さいふ", romaji: "saifu", meaning_zh: "钱包" },
  { phrase: "傘", zh: "伞", kana: "かさ", romaji: "kasa", meaning_zh: "伞" },
  { phrase: "時計", zh: "时计", kana: "とけい", romaji: "tokei", meaning_zh: "钟、表" },
  { phrase: "椅子", zh: "椅子", kana: "いす", romaji: "isu", meaning_zh: "椅子" },
  { phrase: "机", zh: "机", kana: "つくえ", romaji: "tsukue", meaning_zh: "桌子", trap_zh: "中文「机」=机器，日语「机」=书桌" },
  { phrase: "部屋", zh: "部屋", kana: "へや", romaji: "heya", meaning_zh: "房间" },
  { phrase: "荷物", zh: "荷物", kana: "にもつ", romaji: "nimotsu", meaning_zh: "行李", trap_zh: "中文无此词，日语「荷物」=行李/货物" },
  { phrase: "切符", zh: "切符", kana: "きっぷ", romaji: "kippu", meaning_zh: "车票" },
  { phrase: "地図", zh: "地图", kana: "ちず", romaji: "chizu", meaning_zh: "地图" },
  { phrase: "写真", zh: "写真", kana: "しゃしん", romaji: "shashin", meaning_zh: "照片", trap_zh: "中文「写真」=艺术照，日语指普通「照片」" },
  { phrase: "名前", zh: "名前", kana: "なまえ", romaji: "namae", meaning_zh: "名字" },
  { phrase: "住所", zh: "住所", kana: "じゅうしょ", romaji: "jūsho", meaning_zh: "住址" },

  /* ---- transport ---- */
  { phrase: "電車", zh: "电车", kana: "でんしゃ", romaji: "densha", meaning_zh: "电车" },
  { phrase: "汽車", zh: "汽车", kana: "きしゃ", romaji: "kisha", meaning_zh: "火车（蒸汽）", trap_zh: "中文「汽车」=automobile，日语「汽車」=火车" },
  { phrase: "自転車", zh: "自转车", kana: "じてんしゃ", romaji: "jitensha", meaning_zh: "自行车" },
  { phrase: "自動車", zh: "自动车", kana: "じどうしゃ", romaji: "jidōsha", meaning_zh: "汽车" },
  { phrase: "飛行機", zh: "飞行机", kana: "ひこうき", romaji: "hikōki", meaning_zh: "飞机" },
  { phrase: "地下鉄", zh: "地下铁", kana: "ちかてつ", romaji: "chikatetsu", meaning_zh: "地铁" },
  { phrase: "新幹線", zh: "新干线", kana: "しんかんせん", romaji: "shinkansen", meaning_zh: "新干线" },

  /* ---- food ---- */
  { phrase: "料理", zh: "料理", kana: "りょうり", romaji: "ryōri", meaning_zh: "菜肴、做菜" },
  { phrase: "野菜", zh: "野菜", kana: "やさい", romaji: "yasai", meaning_zh: "蔬菜", trap_zh: "中文「野菜」=野生菜，日语泛指「蔬菜」" },
  { phrase: "果物", zh: "果物", kana: "くだもの", romaji: "kudamono", meaning_zh: "水果" },
  { phrase: "牛乳", zh: "牛乳", kana: "ぎゅうにゅう", romaji: "gyūnyū", meaning_zh: "牛奶" },
  { phrase: "御飯", zh: "御饭", kana: "ごはん", romaji: "gohan", meaning_zh: "米饭、饭" },
  { phrase: "弁当", zh: "便当", kana: "べんとう", romaji: "bentō", meaning_zh: "便当" },
  { phrase: "砂糖", zh: "砂糖", kana: "さとう", romaji: "satō", meaning_zh: "糖" },
  { phrase: "醤油", zh: "酱油", kana: "しょうゆ", romaji: "shōyu", meaning_zh: "酱油" },
  { phrase: "飲み物", zh: "饮物", kana: "のみもの", romaji: "nomimono", meaning_zh: "饮料" },

  /* ---- abstract / Sino-Japanese ---- */
  { phrase: "経済", zh: "经济", kana: "けいざい", romaji: "keizai", meaning_zh: "经济" },
  { phrase: "政治", zh: "政治", kana: "せいじ", romaji: "seiji", meaning_zh: "政治" },
  { phrase: "社会", zh: "社会", kana: "しゃかい", romaji: "shakai", meaning_zh: "社会" },
  { phrase: "文化", zh: "文化", kana: "ぶんか", romaji: "bunka", meaning_zh: "文化" },
  { phrase: "歴史", zh: "历史", kana: "れきし", romaji: "rekishi", meaning_zh: "历史" },
  { phrase: "科学", zh: "科学", kana: "かがく", romaji: "kagaku", meaning_zh: "科学" },
  { phrase: "教育", zh: "教育", kana: "きょういく", romaji: "kyōiku", meaning_zh: "教育" },
  { phrase: "環境", zh: "环境", kana: "かんきょう", romaji: "kankyō", meaning_zh: "环境" },
  { phrase: "問題", zh: "问题", kana: "もんだい", romaji: "mondai", meaning_zh: "问题" },
  { phrase: "世界", zh: "世界", kana: "せかい", romaji: "sekai", meaning_zh: "世界" },
  { phrase: "情報", zh: "情报", kana: "じょうほう", romaji: "jōhō", meaning_zh: "信息、资讯", trap_zh: "中文「情报」=intelligence，日语「情報」=信息" },
  { phrase: "会議", zh: "会议", kana: "かいぎ", romaji: "kaigi", meaning_zh: "会议" },
  { phrase: "計画", zh: "计画", kana: "けいかく", romaji: "keikaku", meaning_zh: "计划" },
  { phrase: "準備", zh: "准备", kana: "じゅんび", romaji: "junbi", meaning_zh: "准备" },
  { phrase: "連絡", zh: "联络", kana: "れんらく", romaji: "renraku", meaning_zh: "联系、联络" },
  { phrase: "確認", zh: "确认", kana: "かくにん", romaji: "kakunin", meaning_zh: "确认" },
  { phrase: "説明", zh: "说明", kana: "せつめい", romaji: "setsumei", meaning_zh: "说明" },
  { phrase: "相談", zh: "相谈", kana: "そうだん", romaji: "sōdan", meaning_zh: "商量、咨询" },
  { phrase: "紹介", zh: "绍介", kana: "しょうかい", romaji: "shōkai", meaning_zh: "介绍" },
  { phrase: "招待", zh: "招待", kana: "しょうたい", romaji: "shōtai", meaning_zh: "邀请", trap_zh: "中文「招待」=receive，日语「招待」=邀请、款待" },
  { phrase: "約束", zh: "约束", kana: "やくそく", romaji: "yakusoku", meaning_zh: "约定", trap_zh: "中文「约束」=constrain，日语「約束」=约定" },
  { phrase: "経験", zh: "经验", kana: "けいけん", romaji: "keiken", meaning_zh: "经验" },
  { phrase: "生活", zh: "生活", kana: "せいかつ", romaji: "seikatsu", meaning_zh: "生活" },
  { phrase: "仕事", zh: "仕事", kana: "しごと", romaji: "shigoto", meaning_zh: "工作", trap_zh: "中文无此词，日语「仕事」=工作" },

  /* ---- feelings / states / classic false friends ---- */
  { phrase: "大丈夫", zh: "大丈夫", kana: "だいじょうぶ", romaji: "daijōbu", meaning_zh: "没关系、不要紧", trap_zh: "中文「大丈夫」=男子汉，日语意为「没关系」" },
  { phrase: "邪魔", zh: "邪魔", kana: "じゃま", romaji: "jama", meaning_zh: "打扰、妨碍", trap_zh: "中文「邪魔」=邪恶，日语「邪魔」=打扰" },
  { phrase: "大切", zh: "大切", kana: "たいせつ", romaji: "taisetsu", meaning_zh: "重要、珍惜" },
  { phrase: "親切", zh: "亲切", kana: "しんせつ", romaji: "shinsetsu", meaning_zh: "热心、亲切" },
  { phrase: "丁寧", zh: "丁宁", kana: "ていねい", romaji: "teinei", meaning_zh: "礼貌、细致" },
  { phrase: "簡単", zh: "简单", kana: "かんたん", romaji: "kantan", meaning_zh: "简单" },
  { phrase: "複雑", zh: "复杂", kana: "ふくざつ", romaji: "fukuzatsu", meaning_zh: "复杂" },
  { phrase: "便利", zh: "便利", kana: "べんり", romaji: "benri", meaning_zh: "方便" },
  { phrase: "危険", zh: "危险", kana: "きけん", romaji: "kiken", meaning_zh: "危险" },
  { phrase: "安全", zh: "安全", kana: "あんぜん", romaji: "anzen", meaning_zh: "安全" },
  { phrase: "有名", zh: "有名", kana: "ゆうめい", romaji: "yūmei", meaning_zh: "有名" },
  { phrase: "元気", zh: "元气", kana: "げんき", romaji: "genki", meaning_zh: "精神好、健康", trap_zh: "中文「元气」≠日语，日语「元気」=有精神" },
  { phrase: "心配", zh: "心配", kana: "しんぱい", romaji: "shinpai", meaning_zh: "担心", trap_zh: "中文无此词，日语「心配」=担心" },
  { phrase: "我慢", zh: "我慢", kana: "がまん", romaji: "gaman", meaning_zh: "忍耐", trap_zh: "中文无此词，日语「我慢」=忍耐" },
  { phrase: "遠慮", zh: "远虑", kana: "えんりょ", romaji: "enryo", meaning_zh: "客气、顾虑", trap_zh: "中文「远虑」=long-term thought，日语「遠慮」=客气" },
  { phrase: "迷惑", zh: "迷惑", kana: "めいわく", romaji: "meiwaku", meaning_zh: "麻烦、添乱", trap_zh: "中文「迷惑」=困惑，日语「迷惑」=给人添麻烦" },
  { phrase: "怪我", zh: "怪我", kana: "けが", romaji: "kega", meaning_zh: "受伤", trap_zh: "中文「怪我」=blame me，日语「怪我」=受伤" },
  { phrase: "風邪", zh: "风邪", kana: "かぜ", romaji: "kaze", meaning_zh: "感冒", trap_zh: "中文「风邪」=中医术语，日语「風邪」=感冒" },
  { phrase: "喧嘩", zh: "喧哗", kana: "けんか", romaji: "kenka", meaning_zh: "吵架、打架", trap_zh: "中文「喧哗」=吵闹，日语「喧嘩」=吵架/打架" },
  { phrase: "工夫", zh: "工夫", kana: "くふう", romaji: "kufū", meaning_zh: "想办法、下功夫", trap_zh: "中文「工夫」=时间/本领，日语「工夫」=动脑筋想办法" },
  { phrase: "無理", zh: "无理", kana: "むり", romaji: "muri", meaning_zh: "勉强、办不到", trap_zh: "中文「无理」=unreasonable，日语「無理」=勉强/不可能" },
  { phrase: "得意", zh: "得意", kana: "とくい", romaji: "tokui", meaning_zh: "擅长", trap_zh: "中文「得意」=自满，日语「得意」=擅长" },
  { phrase: "丈夫", zh: "丈夫", kana: "じょうぶ", romaji: "jōbu", meaning_zh: "结实、坚固", trap_zh: "中文「丈夫」=husband，日语「丈夫」=结实" },
  { phrase: "勝手", zh: "胜手", kana: "かって", romaji: "katte", meaning_zh: "任性、擅自" },
  { phrase: "本当", zh: "本当", kana: "ほんとう", romaji: "hontō", meaning_zh: "真的" },
  { phrase: "全部", zh: "全部", kana: "ぜんぶ", romaji: "zenbu", meaning_zh: "全部" },
  { phrase: "一緒", zh: "一绪", kana: "いっしょ", romaji: "issho", meaning_zh: "一起" }
];
