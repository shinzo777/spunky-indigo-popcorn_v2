// -------------------------------------------------------------
// 固定設定値（Firebase ＆ 中継Worker URL ＆ 合言葉）
// -------------------------------------------------------------
export const FIREBASE_PROJECT_ID = 'spunky-indigo-popcorn';
export const AI_PROXY_API_URL = 'https://white-fog-f0b1.wagaya-no-recipe-api.workers.dev/';
export const APP_SECRET_TOKEN = 'wagaya-recipe-2026-secret-token';

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

export const NAV_ITEMS = [
  { key: 'home', iconName: 'home-outline', activeIconName: 'home', label: 'ホーム' },
  { key: 'recipes', iconName: 'book-outline', activeIconName: 'book', label: 'レシピ帳' },
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
    notes: '生姜多めがわが家の黄金比。タレはしっかり絡める！',
    extractedText: '豚の生姜焼き\n【材料】（2人分）\n・豚ロース肉（生姜焼き用）：250g\n・玉ねぎ：1/2個\n・生姜（すりおろし）：小さじ1\n・醤油：大さじ2\n・みりん：大さじ2\n・酒：大さじ1\n・サラダ油：小さじ1\n【作り方】\n1. 玉ねぎは薄切りにし、生姜・醤油・みりん・酒を合わせてタレを作る。\n2. フライパンに油を熱し、豚肉を両面焼き色がつくまで焼いて一度取り出す。\n3. 同じフライパンで玉ねぎを炒め、しんなりしたら肉を戻し、タレを一気に加えて絡める。',
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
    notes: 'キャベツのシャキシャキ感を残すため強火で一気に炒める。',
    extractedText: '豚肉とキャベツの味噌炒め\n【材料】（2人分）\n・豚バラ肉：200g\n・キャベツ：1/4個\n・ピーマン：2個\n・味噌：大さじ2\n・みりん：大さじ1\n・酒：大さじ1\n・砂糖：小さじ1\n・ごま油：小さじ1\n【作り方】\n1. キャベツとピーマンは一口大にざく切りにする。\n2. フライパンにごま油を熱し、豚肉を炒める。\n3. キャベツとピーマンを加えて強火で手早く炒め合わせる。\n4. 合わせた調味料（味噌・みりん・酒・砂糖）を回し入れ、全体に絡める。',
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
    notes: '中火でしっかり蒸し焼きにして肉汁を閉じ込める。',
    extractedText: 'ジューシーハンバーグ\n【材料】（2人分）\n・合い挽き肉：300g\n・玉ねぎ：1/2個\n・卵：1個\n・パン粉：大さじ3\n・牛乳：大さじ2\n・塩・胡椒：少々\n・サラダ油：小さじ1\n【作り方】\n1. 玉ねぎをみじん切りにして電子レンジで1分半加熱し冷ます。\n2. ボウルに挽肉と塩を入れて粘りが出るまでよくこねる。\n3. 玉ねぎ、卵、牛乳で湿らせたパン粉、胡椒を加えて混ぜ成形する。\n4. フライパンで両面に焼き色をつけ、蓋をして弱火で蒸し焼きにする。',
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
    notes: '二度揚げで外はカリッと、中はジューシーに。',
    extractedText: '鶏のから揚げ\n【材料】（2人分）\n・鶏もも肉：300g\n・醤油：大さじ1.5\n・酒：大さじ1\n・生姜（すりおろし）：小さじ1\n・にんにく（すりおろし）：小さじ1/2\n・片栗粉：大さじ3\n・揚げ油：適量\n【作り方】\n1. 鶏もも肉を一口大に切る。\n2. ポリ袋に鶏肉、醤油、酒、生姜、にんにくを入れてよく揉み込み15分置く。\n3. 片栗粉を全体にしっかりまぶす。\n4. 170度の油で3分揚げ、一度取り出して2分休ませ、180度で二度揚げする。',
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
    notes: '少し冷ますと味が染み込んでさらに美味しくなる。',
    extractedText: 'ほっこり肉じゃが\n【材料】（2人分）\n・豚肉（または牛肉）：150g\n・じゃがいも：2個\n・玉ねぎ：1/2個\n・人参：1/2本\n・水：200ml\n・醤油：大さじ2\n・みりん：大さじ2\n・砂糖：大さじ1\n・だしの素：小さじ1/2\n【作り方】\n1. じゃがいもは乱切りにして水にさらし、玉ねぎ、人参を切る。\n2. 鍋に油を熱し、肉を炒め、野菜を加えて炒め合わせる。\n3. 水、だしの素、砂糖、みりんを加えて落とし蓋をし10分煮る。\n4. 醤油を加え、煮汁が少なくなるまでさらに7〜8分煮詰める。',
  },
,
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
    notes: 'しっかり水分を絞るのが水っぽくならないコツ。',
    extractedText: 'やみつきコールスロー\n【材料】（2〜3人分）\n・キャベツ：1/4個\n・人参：1/4本\n・コーン缶：大さじ3\n・マヨネーズ：大さじ2\n・酢：小さじ1\n・砂糖：小さじ1/2\n・塩・胡椒：少々\n【作り方】\n1. キャベツと人参は千切りにし、塩もみして10分置き水気をしっかり絞る。\n2. ボウルにマヨネーズ、酢、砂糖、胡椒を混ぜ合わせる。\n3. 水気を絞った野菜とコーンを加えてよく和え、冷蔵庫で冷やす。',
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
    notes: 'すりごま多めが香ばしくて美味しい。',
    extractedText: 'ほうれん草のごま和え\n【材料】（2人分）\n・ほうれん草：1袋（200g）\n・白すりごま：大さじ2\n・醤油：大さじ1\n・砂糖：小さじ1\n【作り方】\n1. 沸騰したお湯に塩少々を入れ、ほうれん草を茹でて冷水にとり水気を絞る。\n2. 3〜4cm長さに切る。\n3. ボウルですりごま、醤油、砂糖をよく混ぜ合わせ、ほうれん草を加えて和える。',
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
    notes: 'ごま油の風味を効かせて甘辛く。',
    extractedText: '定番きんぴらごぼう\n【材料】（2〜3人分）\n・ごぼう：1本\n・人参：1/2本\n・ごま油：小さじ2\n・醤油：大さじ1.5\n・みりん：大さじ1\n・酒：大さじ1\n・砂糖：小さじ1\n・白ごま：少々\n【作り方】\n1. ごぼうと人参は細切りにし、ごぼうは水に5分さらして水気を切る。\n2. フライパンにごま油を熱し、ごぼうと人参をしんなりするまで炒める。\n3. 調味料を加え、汁気がなくなるまで炒り煮にして白ごまを振る。',
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
    notes: '根菜の旨味が溶け出す冬の定番。',
    extractedText: '具だくさん豚汁\n【材料】（3〜4人分）\n・豚バラ肉：100g\n・大根：3cm\n・人参：1/3本\n・ごぼう：1/3本\n・こんにゃく：1/3枚\n・長ねぎ：1/2本\n・だし汁：600ml\n・味噌：大さじ3\n・ごま油：小さじ1\n【作り方】\n1. 具材を食べやすい大きさに切る。\n2. 鍋にごま油を熱し、豚肉と野菜を炒める。\n3. だし汁を加えて煮立たせ、弱火で10分煮る。\n4. 味噌を溶き入れ、長ねぎを加えてひと煮立ちさせる。',
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
    notes: '味噌を入れたら沸騰させないのが香りを残す秘訣。',
    extractedText: '豆腐とわかめの王道味噌汁\n【材料】（2人分）\n・絹ごし豆腐：1/2丁\n・乾燥わかめ：大さじ1\n・長ねぎ：1/4本\n・だし汁：400ml\n・味噌：大さじ1.5〜2\n【作り方】\n1. 豆腐はさいの目切り、長ねぎは小口切り、わかめは戻す。\n2. 鍋にだし汁を入れて沸かし、豆腐を加える。\n3. 弱火にして味噌を溶き入れ、わかめとねぎを加えて火を止める。',
  },
];
