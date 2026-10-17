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
// 要件1：出典プラットフォーム定義（操作・見出しは線画アイコン Ionicons に統一）
// -------------------------------------------------------------
export const SOURCE_PLATFORMS = {
  youtube: {
    key: 'youtube',
    label: 'YouTube',
    ionicon: 'logo-youtube',
    accentColor: '#C85A17',
    actionLabel: '元の動画を見る',
  },
  instagram: {
    key: 'instagram',
    label: 'Instagram',
    ionicon: 'logo-instagram',
    accentColor: '#C85A17',
    actionLabel: '元の投稿を見る',
  },
  x: {
    key: 'x',
    label: 'X',
    ionicon: 'logo-twitter',
    accentColor: '#C85A17',
    actionLabel: '元の投稿を見る',
  },
  web: {
    key: 'web',
    label: 'Web',
    ionicon: 'globe-outline',
    accentColor: '#C85A17',
    actionLabel: '元レシピを見る',
  },
  manual: {
    key: 'manual',
    label: 'オリジナル',
    ionicon: 'create-outline',
    accentColor: '#5B8A72',
    actionLabel: '元ページを見る',
  },
};

// -------------------------------------------------------------
// 要件2：AIレシピ抽出用システムプロンプト（著作権配慮・超要約化）
// -------------------------------------------------------------


// ★ 温かみのある配色はそのままに、補足文字の明暗差（コントラスト）と枠線を整理したパレット
export const THEMES = {
  light: {
    isDark: false,
    bg: '#FAF6F0',             // 温かいアイボリー
    cardBg: '#FFFFFF',         // 純白カード
    headerBg: '#FAF6F0',       // シームレスヘッダー
    textMain: '#26150E',       // 深みのあるエスプレッソ（見出し・本文用）
    textSub: '#4E3629',        // カフェモカ（中見出し・ラベル用）
    textMuted: '#6E5648',      // 補足文字もくっきり読める濃いめのトープ（旧 #967D6D から明暗差を改善）
    border: '#E5DACB',         // 薄い実線ボーダー（旧 rgba から視認性を安定化）
    borderInput: '#D6C7B5',    // 入力欄・補助ボタン用の枠線
    inputBg: '#FFFFFF',
    primary: '#C85A17',        // 主要操作用のテラコッタ・オレンジ
    primaryLight: '#FDF3EB',   // 記録あり日・選択背景用の淡いピーチ
    primaryBorder: '#EFCAB0',
    chipBg: '#F2EBE1',         // 控えめなサンドベージュ
    navBg: '#FAF6F0',
    accentSage: '#4A7860',     // 落ち着いたオリーブセージ
    accentBordeaux: '#B03A2E', // 削除・警告用のボルドー
    statusBar: 'dark-content',
  },
  dark: {
    isDark: true,
    bg: '#141210',
    cardBg: '#1F1B18',
    headerBg: '#141210',
    textMain: '#F8F5F0',
    textSub: '#DDD2C8',
    textMuted: '#B5A89E',      // ダーク背景でも読みやすい明るさに改善
    border: '#302924',
    borderInput: '#40362F',
    inputBg: '#26201B',
    primary: '#E07538',
    primaryLight: '#2C1E15',
    primaryBorder: '#523422',
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
  if (month >= 3 && month <= 5) return 'leaf-outline';
  if (month >= 6 && month <= 8) return 'sunny-outline';
  if (month >= 9 && month <= 11) return 'nutrition-outline';
  return 'snow-outline';
};

// 絵文字は料理写真の仮画像（プレースホルダー）用として保持
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
  { key: 'produce', label: '野菜・果物', icon: 'nutrition-outline' },
  { key: 'meat', label: '肉・魚', icon: 'fish-outline' },
  { key: 'dairy', label: '日配・大豆・卵', icon: 'egg-outline' },
  { key: 'seasoning', label: '調味料・乾物', icon: 'flask-outline' },
  { key: 'other', label: 'その他・日用品', icon: 'pricetag-outline' },
];

export const STAPLE_SEASONINGS_REGEX = /醤油|しょうゆ|みりん|料理酒|酒|砂糖|さとう|塩|しお|胡椒|こしょう|コショウ|サラダ油|ごま油|オリーブオイル|油|米油|味噌|みそ|酢|す|だしの素|ほんだし|コンソメ|鶏がらスープ|片栗粉|小麦粉/;

// ボトムナビゲーションバー
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

export const EAT_OUT_ID = 'eat_out_record';
export const DELI_ID = 'deli_record';
