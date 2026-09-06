// 食材キーワードによるスーパー売り場判定
export const categorizeIngredient = (text) => {
  const t = text.toLowerCase();
  if (/玉ねぎ|ねぎ|ネギ|キャベツ|白菜|人参|にんじん|大根|トマト|きゅうり|レタス|ピーマン|じゃがいも|さつまいも|なす|茄子|きのこ|しめじ|えのき|まいたけ|椎茸|ほうれん草|もやし|ニラ|生姜|しょうが|にんにく|ニンニク|アボカド|レモン|果物|りんご|バナナ|ブロッコリー|かぼちゃ|パプリカ|青じそ|大葉|ごぼう|里芋/.test(t)) {
    return 'produce';
  }
  if (/豚|牛|鶏|肉|ひき肉|挽肉|ささみ|ベーコン|ハム|ウインナー|ソーセージ|鮭|魚|えび|エビ|イカ|タコ|ぶり|さば|マグロ|ツナ|シーチキン|たら|あさり|ホタテ|ちりめん/.test(t)) {
    return 'meat';
  }
  if (/卵|たまご|牛乳|チーズ|バター|ヨーグルト|豆腐|とうふ|納豆|油揚げ|厚揚げ|豆乳|こんにゃく|ちくわ|かまぼこ/.test(t)) {
    return 'dairy';
  }
  if (/醤油|しょうゆ|みりん|酒|砂糖|塩|胡椒|こしょう|油|オリーブオイル|ごま油|味噌|みそ|酢|ポン酢|だし|出汁|コンソメ|スープ|マヨネーズ|ケチャップ|ソース|つゆ|小麦粉|片栗粉|パン粉|ごま|ゴマ|カレー|ルウ/.test(t)) {
    return 'seasoning';
  }
  return 'other';
};

// レシピ本文から材料行を自動抽出する関数
export const extractIngredientsFromRecipeText = (text) => {
  if (!text) return [];
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  let inIngredients = false;
  const items = [];

  for (const line of lines) {
    if (/材料|【材料】|〔材料〕|＜材料＞/.test(line)) {
      inIngredients = true;
      continue;
    }
    if (/作り方|手順|【作り方】|〔作り方〕|＜作り方＞/.test(line)) {
      inIngredients = false;
      break;
    }
    if (inIngredients) {
      const cleaned = line.replace(/^[・\-\*•\d\.\s]+/, '').trim();
      if (cleaned.length > 0 && !/^\(.*\)$|^（.*）$/.test(cleaned)) {
        items.push({
          id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: cleaned,
          aisle: categorizeIngredient(cleaned),
          checked: false,
        });
      }
    }
  }

  if (items.length === 0) {
    for (const line of lines) {
      if (/^[・\-\*]/.test(line)) {
        const cleaned = line.replace(/^[・\-\*•\s]+/, '').trim();
        if (cleaned.length > 0) {
          items.push({
            id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            name: cleaned,
            aisle: categorizeIngredient(cleaned),
            checked: false,
          });
        }
      }
    }
  }

  return items;
};

// 1兆通り以上の高セキュリティ家族ID生成
export const generateNewFamilyId = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let part1 = '';
  let part2 = '';
  for (let i = 0; i < 4; i++) {
    part1 += chars.charAt(Math.floor(Math.random() * chars.length));
    part2 += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `FAM-${part1}-${part2}`;
};

// 「直近の献立」の日付表示ヘルパー（例: 今日、昨日、2日前、9/3）
export const formatRelativeDate = (dateStr) => {
  if (!dateStr) return '';
  const target = new Date(dateStr);
  const now = new Date();
  
  // 日付の差分（日単位）
  const diffTime = now.setHours(0, 0, 0, 0) - target.setHours(0, 0, 0, 0);
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return '今日';
  if (diffDays === 1) return '昨日';
  if (diffDays === 2) return '一昨日';
  if (diffDays <= 6) return `${diffDays}日前`;

  const m = target.getMonth() + 1;
  const d = target.getDate();
  return `${m}/${d}`;
};
// ★ 季節に応じた旬アイコン判定
export const getSeasonIcon = (month) => {
  if (month >= 3 && month <= 5) return '🌸'; // 春 (3〜5月)
  if (month >= 6 && month <= 8) return '🌻'; // 夏 (6〜8月)
  if (month >= 9 && month <= 11) return '🍁'; // 秋 (9〜11月)
  return '❄️'; // 冬 (12〜2月)
};