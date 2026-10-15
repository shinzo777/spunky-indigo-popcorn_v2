// -------------------------------------------------------------
// 固定設定値（Firebase ＆ 中継Worker URL ＆ 合言葉）
// -------------------------------------------------------------
export const FIREBASE_PROJECT_ID = 'spunky-indigo-popcorn';
export const AI_PROXY_API_URL = 'https://white-fog-f0b1.wagaya-no-recipe-api.workers.dev/';
export const APP_SECRET_TOKEN = 'wagaya-recipe-2026-secret-token';

// カレンダー履歴の保管期間（直近1年分 = 366日）
export const CALENDAR_RETENTION_DAYS = 366;
export const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

// -------------------------------------------------------------
// 要件1：出典プラットフォーム定義
// -------------------------------------------------------------
export const SOURCE_PLATFORMS = {
  youtube: {
    key: 'youtube',
    label: 'YouTube',
    icon: '▶️',
    ionicon: 'logo-youtube',
    accentColor: '#DC2626',
    bgLight: '#FEF2F2',
    borderLight: '#FECACA',
    actionLabel: '元のYouTube動画を見る',
  },
  instagram: {
    key: 'instagram',
    label: 'Instagram',
    icon: '📸',
    ionicon: 'logo-instagram',
    accentColor: '#DB2777',
    bgLight: '#FDF2F8',
    borderLight: '#FBCFE8',
    actionLabel: '元のInstagram投稿を見る',
  },
  x: {
    key: 'x',
    label: 'X (旧Twitter)',
    icon: '𝕏',
    ionicon: 'logo-twitter',
    accentColor: '#1D4ED8',
    bgLight: '#EFF6FF',
    borderLight: '#BFDBFE',
    actionLabel: '元のX投稿を見る',
  },
  web: {
    key: 'web',
    label: 'Webレシピ',
    icon: '🌐',
    ionicon: 'globe-outline',
    accentColor: '#C85A17',
    bgLight: '#FDF3EB',
    borderLight: '#F5D7C3',
    actionLabel: '元のレシピ記事を見る',
  },
  manual: {
    key: 'manual',
    label: '手動・オリジナル',
    icon: '✍️',
    ionicon: 'create-outline',
    accentColor: '#5B8A72',
    bgLight: '#F3ECE2',
    borderLight: '#E8DCCE',
    actionLabel: '元のページを見る',
  },
};

// -------------------------------------------------------------
// 要件2：AIレシピ抽出用システムプロンプト（著作権配慮・超要約化）
// -------------------------------------------------------------
export const RECIPE_EXTRACTION_SYSTEM_PROMPT = `あなたはレシピ考案者（クリエイター）の権利と著作権を厳格に保護するレシピ構造化AIアシスタントです。
入力されたWebページやSNS（YouTube / Instagram / X等）の情報・テキストから、以下の4つのルールを厳守してJSON形式のみで出力してください。

【厳守ルール】
1. 事実データのみの抽出（表現のコピー禁止）
   - クリエイター独自の言い回し、導入のエピソード、コラム、独自のコツ表現、感想は絶対にコピーしないこと。
   - 「材料リスト（食材名・分量・単位）」と「調理手順の最小限の骨組み」という、著作権の及ばない事実情報のみを抽出・正規化すること。
2. 調理手順の「インデックス化（1行超要約）」
   - 各手順（steps）は原文を丸写しせず、「① 玉ねぎを薄切りにする」「② 中火で豚肉を炒め、調味料Aを加える」のように、1ステップあたり最大40文字程度の簡潔な動詞表現（インデックス）に要約すること。
   - 微妙な火加減のコツや詳細なノウハウはあえて省略し、ユーザーが初回調理時に元サイト（動画や記事）を見に行く動機を残すこと。
3. クリエイター名の抽出
   - ページ内のメタデータ、著者名、チャンネル名、SNSアカウント名、サイト名から考案者（creatorName）を特定してJSONに含めること（特定できない場合は null）。
   - 元ページのOGPタイトルがわかる場合は ogpTitle に含めること（不明な場合は null）。
   - robots.txt や meta noarchive 等により抽出・要約が禁止されている場合は isScrapedAllowed を false にし、ingredients と steps は空配列にすること。
4. 画像の非保存
   - 元サイト内の料理画像URLや工程写真URLを抽出・出力する処理は一切行わないこと。

【出力JSONフォーマット（コードブロックなしの純粋なJSONオブジェクト）】
{
  "title": "料理名（簡潔な名称）",
  "creatorName": "考案者名・チャンネル名・アカウント名・サイト名（不明時は null）",
  "ogpTitle": "元ページのOGPタイトル（不明時は null）",
  "isScrapedAllowed": true,
  "cookingTime": 15,
  "category": "主菜",
  "ingredients": [
    { "name": "豚ロース肉", "amount": "250", "unit": "g" },
    { "name": "玉ねぎ", "amount": "1/2", "unit": "個" }
  ],
  "steps": [
    "① 玉ねぎを薄切りにし、調味料を合わせる",
    "② フライパンで豚肉の両面を焼き一度取り出す",
    "③ 玉ねぎを炒めて肉を戻し、タレを絡める"
  ]
}`;

// ★ 高級感のある温かいカフェ・北欧ニュアンスパレット
export const THEMES = {
  light: {
    isDark: false,
    bg: '#FAF6F0',             // 上品な温かいアイボリー
    cardBg: '#FFFFFF',         // 純白の浮遊カード
    headerBg: '#FAF6F0',       // 境目のないシームレスヘッダー
    textMain: '#2C1810',       // 深みのある上質エスプレッソ
    textSub: '#5C4033',        // 温かいカフェモカ
    textMuted: '#967D6D',      // 柔らかなトープ
    border: 'rgba(230, 215, 195, 0.45)', // 極薄の空気のような境界線
    borderInput: '#E8DCCE',
    inputBg: '#FFFFFF',
    primary: '#C85A17',        // 上品なテラコッタ・柿色
    primaryLight: '#FDF3EB',   // 柔らかなピーチアイボリー
    primaryBorder: '#F5D7C3',
    chipBg: '#F3ECE2',         // やわらかなサンドベージュ
    navBg: '#FAF6F0',
    accentSage: '#5B8A72',     // 洗練されたオリーブセージ（緑）
    accentBordeaux: '#B03A2E', // 落ち着いたルージュボルドー（赤）
    statusBar: 'dark-content',
  },
  dark: {
    isDark: true,
    bg: '#141210',
    cardBg: '#1F1B18',
    headerBg: '#141210',
    textMain: '#F8F5F0',
    textSub: '#D6CBC2',
    textMuted: '#9E9085',
    border: 'rgba(255, 255, 255, 0.08)',
    borderInput: '#332B25',
    inputBg: '#26201B',
    primary: '#E07538',
    primaryLight: '#2C1B12',
    primaryBorder: '#4D2F1E',
    chipBg: '#2A231D',
    navBg: '#141210',
    accentSage: '#76A68D',
    accentBordeaux: '#CF5C4E',
    statusBar: 'light-content',
  },
};

export const MONTHLY_SEASONAL_MAP = {
  1: '白菜・大根・れんこん・ほうれん草・長ネギ・小松菜・寒ブリ・真鱈・牡蠣・みかん・いちご',
  2: '小松菜・ブロッコリー・キャベツ・大根・長ネギ・真鱈・寒ブリ・牡蠣・ヤリイカ・いちご・いよかん',
  3: '春キャベツ・新玉ねぎ・菜の花・アスパラガス・スナップエンドウ・あさり・サワラ・真鯛・いちご',
  4: 'たけのこ・新玉ねぎ・春キャベツ・アスパラガス・新じゃが・サワラ・初鰹・真鯛・あさり・甘夏',
  5: '新じゃが・新ごぼう・そら豆・さやえんどう・アスパラガス・初鰹・アジ・真鯛・メバル・びわ',
  6: 'トマト・きゅうり・ナス・オクラ・ズッキーニ・枝豆・アジ・イワシ・鮎・梅・さくらんぼ',
  7: 'ナス・トマト・きゅうり・とうもろこし・ピーマン・枝豆・ゴーヤ・うなぎ・アジ・タコ・すいか・桃',
  8: 'トマト・ナス・ピーマン・ゴーヤ・オクラ・かぼちゃ・モロヘイヤ・タコ・スズキ・イワシ・すいか・ぶどう',
  9: '秋鮭・秋刀魚・きのこ・さつまいも・れんこん・かぼちゃ・ナス・里芋・梨・ぶどう',
  10: '秋刀魚・秋鮭・きのこ・さつまいも・里芋・れんこん・チンゲン菜・かぶ・栗・柿・りんご',
  11: '大根・白菜・長ネギ・春菊・里芋・れんこん・ごぼう・サバ・秋鮭・ブリ・牡蠣・りんご・みかん',
  12: '白菜・大根・ほうれん草・春菊・長ネギ・れんこん・寒ブリ・真鱈・牡蠣・カニ・みかん・ゆず',
};

export const getSeasonIcon = (month) => {
  if (month >= 3 && month <= 5) return '🌸';
  if (month >= 6 && month <= 8) return '🌻';
  if (month >= 9 && month <= 11) return '🍁';
  return '❄️';
};

export const CATEGORIES = [
  { key: '主菜', label: '主菜', icon: '🥩' },
  { key: '副菜', label: '副菜', icon: '🥗' },
  { key: '汁物', label: '汁物', icon: '🍲' },
  { key: '飯類', label: '飯類', icon: '🍚' },
  { key: 'デザート', label: 'デザート', icon: '🍰' },
  { key: '調味料', label: '調味料', icon: '🧂' },
  { key: '離乳食', label: '離乳食', icon: '🍼' },
  { key: 'その他', label: 'その他', icon: '🍽️' },
];

export const DEFAULT_MEMBERS = [
  { id: 'm1', name: '自分' },
  { id: 'm2', name: 'パートナー' },
];

export const RATING_STARS = ['☆☆☆', '★☆☆', '★★☆', '★★★'];

export const SHOPPING_AISLES = [
  { key: 'produce', label: '🥬 野菜・果物' },
  { key: 'meat', label: '🥩 肉・魚' },
  { key: 'dairy', label: '🥛 日配・大豆・卵' },
  { key: 'seasoning', label: '🧂 調味料・乾物' },
  { key: 'other', label: '🏷️ その他・日用品' },
];

export const STAPLE_SEASONINGS_REGEX = /醤油|しょうゆ|みりん|料理酒|酒|砂糖|さとう|塩|しお|胡椒|こしょう|コショウ|サラダ油|ごま油|オリーブオイル|油|米油|味噌|みそ|酢|す|だしの素|ほんだし|コンソメ|鶏がらスープ|片栗粉|小麦粉/;

// ★ ボトムナビゲーションバーに「カレンダー」を追加
export const NAV_ITEMS = [
  { key: 'home', iconName: 'home-outline', activeIconName: 'home', label: 'ホーム' },
  { key: 'recipes', iconName: 'book-outline', activeIconName: 'book', label: 'レシピ帳' },
  { key: 'calendar', iconName: 'calendar-outline', activeIconName: 'calendar', label: 'カレンダー' },
  { key: 'shopping', iconName: 'cart-outline', activeIconName: 'cart', label: '買い物' },
  { key: 'settings', iconName: 'settings-outline', activeIconName: 'settings', label: '設定' },
];

export const PRESET_DEFAULT_RECIPES = [
  {
    id: 'preset_01',
    title: '豚の生姜焼き',
    category: '主菜',
    isDefault: true,
    isCooked: true,
    familyRatings: {},
    cookingTime: 15,
    isBento: true,
    isMealPrep: false,
    sourceUrl: '',
    sourcePlatform: 'manual',
    creatorName: null,
    ogpTitle: null,
    isScrapedAllowed: true,
    notes: '生姜多めがわが家の黄金比。タレはしっかり絡める！',
    extractedText: '豚の生姜焼き\n【材料】（2人分）\n・豚ロース肉（生姜焼き用）：250g\n・玉ねぎ：1/2個\n・生姜（すりおろし）：小さじ1\n・醤油：大さじ2\n・みりん：大さじ2\n・酒：大さじ1\n・サラダ油：小さじ1\n【作り方】\n① 玉ねぎを薄切りにし、調味料を合わせる\n② フライパンで豚肉を両面焼き一度取り出す\n③ 玉ねぎを炒めて肉を戻し、タレを絡める',
  },
  {
    id: 'preset_02',
    title: '豚肉とキャベツの味噌炒め',
    category: '主菜',
    isDefault: true,
    isCooked: true,
    familyRatings: {},
    cookingTime: 15,
    isBento: true,
    isMealPrep: false,
    sourceUrl: '',
    sourcePlatform: 'manual',
    creatorName: null,
    ogpTitle: null,
    isScrapedAllowed: true,
    notes: 'キャベツのシャキシャキ感を残すため強火で一気に炒める。',
    extractedText: '豚肉とキャベツの味噌炒め\n【材料】（2人分）\n・豚バラ肉：200g\n・キャベツ：1/4個\n・ピーマン：2個\n・味噌：大さじ2\n・みりん：大さじ1\n・酒：大さじ1\n・砂糖：小さじ1\n・ごま油：小さじ1\n【作り方】\n① キャベツとピーマンを一口大に切る\n② ごま油で豚バラ肉を炒める\n③ 野菜を加えて強火で手早く炒め合わせる\n④ 合わせた味噌ダレを回し入れ全体に絡める',
  },
  {
    id: 'preset_03',
    title: 'ジューシーハンバーグ',
    category: '主菜',
    isDefault: true,
    isCooked: true,
    familyRatings: {},
    cookingTime: 30,
    isBento: true,
    isMealPrep: true,
    sourceUrl: '',
    sourcePlatform: 'manual',
    creatorName: null,
    ogpTitle: null,
    isScrapedAllowed: true,
    notes: '中火でしっかり蒸し焼きにして肉汁を閉じ込める。',
    extractedText: 'ジューシーハンバーグ\n【材料】（2人分）\n・合い挽き肉：300g\n・玉ねぎ：1/2個\n・卵：1個\n・パン粉：大さじ3\n・牛乳：大さじ2\n・塩・胡椒：少々\n・サラダ油：小さじ1\n【作り方】\n① みじん切り玉ねぎをレンジ加熱し冷ます\n② ボウルで挽肉と塩を粘りが出るまでこねる\n③ 残りの材料を加えて混ぜ、小判型に成形する\n④ 両面を焼き、蓋をして弱火で蒸し焼きにする',
  },
  {
    id: 'preset_04',
    title: '鶏のから揚げ',
    category: '主菜',
    isDefault: true,
    isCooked: true,
    familyRatings: {},
    cookingTime: 25,
    isBento: true,
    isMealPrep: true,
    sourceUrl: '',
    sourcePlatform: 'manual',
    creatorName: null,
    ogpTitle: null,
    isScrapedAllowed: true,
    notes: '二度揚げで外はカリッと、中はジューシーに。',
    extractedText: '鶏のから揚げ\n【材料】（2人分）\n・鶏もも肉：300g\n・醤油：大さじ1.5\n・酒：大さじ1\n・生姜（すりおろし）：小さじ1\n・にんにく（すりおろし）：小さじ1/2\n・片栗粉：大さじ3\n・揚げ油：適量\n【作り方】\n① 鶏もも肉を一口大に切る\n② 調味料を揉み込み15分置く\n③ 片栗粉を全体にまぶす\n④ 油でカラッと二度揚げする',
  },
  {
    id: 'preset_05',
    title: 'ほっこり肉じゃが',
    category: '主菜',
    isDefault: true,
    isCooked: true,
    familyRatings: {},
    cookingTime: 35,
    isBento: false,
    isMealPrep: true,
    sourceUrl: '',
    sourcePlatform: 'manual',
    creatorName: null,
    ogpTitle: null,
    isScrapedAllowed: true,
    notes: '少し冷ますと味が染み込んでさらに美味しくなる。',
    extractedText: 'ほっこり肉じゃが\n【材料】（2人分）\n・豚肉（または牛肉）：150g\n・じゃがいも：2個\n・玉ねぎ：1/2個\n・人参：1/2本\n・水：200ml\n・醤油：大さじ2\n・みりん：大さじ2\n・砂糖：大さじ1\n・だしの素：小さじ1/2\n【作り方】\n① 野菜と肉を食べやすい大きさに切る\n② 鍋に油を熱し、肉と野菜を炒め合わせる\n③ 水・だし・砂糖・みりんを加え10分煮る\n④ 醤油を加え、煮汁が減るまで煮詰める',
  },
  {
    id: 'preset_06',
    title: 'やみつきコールスロー',
    category: '副菜',
    isDefault: true,
    isCooked: true,
    familyRatings: {},
    cookingTime: 10,
    isBento: false,
    isMealPrep: true,
    sourceUrl: '',
    sourcePlatform: 'manual',
    creatorName: null,
    ogpTitle: null,
    isScrapedAllowed: true,
    notes: 'しっかり水分を絞るのが水っぽくならないコツ。',
    extractedText: 'やみつきコールスロー\n【材料】（2〜3人分）\n・キャベツ：1/4個\n・人参：1/4本\n・コーン缶：大さじ3\n・マヨネーズ：大さじ2\n・酢：小さじ1\n・砂糖：小さじ1/2\n・塩・胡椒：少々\n【作り方】\n① キャベツと人参を千切りにし塩もみして絞る\n② ボウルで調味料を混ぜ合わせる\n③ 野菜とコーンを加えて和え、冷蔵庫で冷やす',
  },
  {
    id: 'preset_07',
    title: 'ほうれん草のごま和え',
    category: '副菜',
    isDefault: true,
    isCooked: true,
    familyRatings: {},
    cookingTime: 10,
    isBento: true,
    isMealPrep: true,
    sourceUrl: '',
    sourcePlatform: 'manual',
    creatorName: null,
    ogpTitle: null,
    isScrapedAllowed: true,
    notes: 'すりごま多めが香ばしくて美味しい。',
    extractedText: 'ほうれん草のごま和え\n【材料】（2人分）\n・ほうれん草：1袋（200g）\n・白すりごま：大さじ2\n・醤油：大さじ1\n・砂糖：小さじ1\n【作り方】\n① ほうれん草を塩茹でして水気を絞る\n② 3〜4cm長さに切る\n③ すりごま・醤油・砂糖と和える',
  },
  {
    id: 'preset_08',
    title: '定番きんぴらごぼう',
    category: '副菜',
    isDefault: true,
    isCooked: true,
    familyRatings: {},
    cookingTime: 20,
    isBento: true,
    isMealPrep: true,
    sourceUrl: '',
    sourcePlatform: 'manual',
    creatorName: null,
    ogpTitle: null,
    isScrapedAllowed: true,
    notes: 'ごま油の風味を効かせて甘辛く。',
    extractedText: '定番きんぴらごぼう\n【材料】（2〜3人分）\n・ごぼう：1本\n・人参：1/2本\n・ごま油：小さじ2\n・醤油：大さじ1.5\n・みりん：大さじ1\n・酒：大さじ1\n・砂糖：小さじ1\n・白ごま：少々\n【作り方】\n① ごぼうと人参を細切りにし水にさらす\n② ごま油でしんなりするまで炒める\n③ 調味料を加え汁気がなくなるまで炒り煮する',
  },
  {
    id: 'preset_09',
    title: '具だくさん豚汁',
    category: '汁物',
    isDefault: true,
    isCooked: true,
    familyRatings: {},
    cookingTime: 25,
    isBento: false,
    isMealPrep: true,
    sourceUrl: '',
    sourcePlatform: 'manual',
    creatorName: null,
    ogpTitle: null,
    isScrapedAllowed: true,
    notes: '根菜の旨味が溶け出す冬の定番。',
    extractedText: '具だくさん豚汁\n【材料】（3〜4人分）\n・豚バラ肉：100g\n・大根：3cm\n・人参：1/3本\n・ごぼう：1/3本\n・こんにゃく：1/3枚\n・長ねぎ：1/2本\n・だし汁：600ml\n・味噌：大さじ3\n・ごま油：小さじ1\n【作り方】\n① 具材を食べやすい大きさに切る\n② ごま油で豚肉と根菜を炒める\n③ だし汁を加え弱火で10分煮る\n④ 味噌を溶き入れ、長ねぎを加える',
  },
  {
    id: 'preset_10',
    title: '豆腐とわかめの王道味噌汁',
    category: '汁物',
    isDefault: true,
    isCooked: true,
    familyRatings: {},
    cookingTime: 10,
    isBento: false,
    isMealPrep: false,
    sourceUrl: '',
    sourcePlatform: 'manual',
    creatorName: null,
    ogpTitle: null,
    isScrapedAllowed: true,
    notes: '味噌を入れたら沸騰させないのが香りを残す秘訣。',
    extractedText: '豆腐とわかめの王道味噌汁\n【材料】（2人分）\n・絹ごし豆腐：1/2丁\n・乾燥わかめ：大さじ1\n・長ねぎ：1/4本\n・だし汁：400ml\n・味噌：大さじ1.5〜2\n【作り方】\n① 豆腐とねぎを切り、わかめを戻す\n② 鍋にだし汁を沸かし、豆腐を加える\n③ 弱火で味噌を溶き、わかめとねぎを加える',
  },
];
