import { Platform } from 'react-native';
import { STAPLE_SEASONINGS_REGEX } from './constants';

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

export const extractIngredientsFromRecipeText = (text, excludeStaples = false) => {
  if (!text) return [];
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  let inIngredients = false;
  const items = [];

  const ignorePattern = /カロリー|kcal|塩分|調理時間|所要時間|目安時間|エネルギー|糖質|脂質|たんぱく質|タンパク質|費用|難易度|人分|人前|下準備|ポイント|memo|メモ/i;

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
      if (ignorePattern.test(line)) continue;
      if (/^[【〔＜\(\（\[].*?[】〕＞\)\）\]]$/.test(line)) continue;

      const cleaned = line.replace(/^[・\-\*•\d\.\s]+/, '').trim();
      if (cleaned.length > 0) {
        if (excludeStaples && STAPLE_SEASONINGS_REGEX.test(cleaned)) {
          continue;
        }

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
        if (ignorePattern.test(line)) continue;
        const cleaned = line.replace(/^[・\-\*•\s]+/, '').trim();
        if (cleaned.length > 0) {
          if (excludeStaples && STAPLE_SEASONINGS_REGEX.test(cleaned)) continue;
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

export const scaleIngredientLine = (line, factor = 1) => {
  if (factor === 1) return line;
  return line.replace(/(\d+\/\d+|\d+(?:\.\d+)?)/g, (match) => {
    let val;
    if (match.includes('/')) {
      const [n, d] = match.split('/');
      val = parseFloat(n) / parseFloat(d);
    } else {
      val = parseFloat(match);
    }
    const scaled = val * factor;
    if (Number.isInteger(scaled)) return String(scaled);
    return String(Math.round(scaled * 10) / 10);
  });
};

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

export const formatRelativeDate = (dateStr) => {
  if (!dateStr) return '';
  const target = new Date(dateStr);
  const now = new Date();
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

export const compressImageForFirestore = async (dataUri, maxDimension = 600, quality = 0.5) => {
  if (!dataUri || typeof window === 'undefined') return dataUri;
  if (!dataUri.startsWith('data:image')) return dataUri;

  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      let w = img.width;
      let h = img.height;
      if (w > maxDimension || h > maxDimension) {
        if (w > h) {
          h = Math.round((h * maxDimension) / w);
          w = maxDimension;
        } else {
          w = Math.round((w * maxDimension) / h);
          h = maxDimension;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUri);
    img.src = dataUri;
  });
};

export const processAssetForUpload = async (asset) => {
  if (!asset) return null;

  if (asset.base64) {
    let mime = 'image/jpeg';
    if (asset.uri && asset.uri.toLowerCase().endsWith('.png')) mime = 'image/png';
    return {
      base64: asset.base64,
      mimeType: mime,
      dataUri: `data:${mime};base64,${asset.base64}`,
    };
  }

  if (asset.uri) {
    try {
      const response = await fetch(asset.uri);
      const blob = await response.blob();

      const rawDataUri = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.Image !== 'undefined') {
        const compressedUri = await new Promise((resolve) => {
          const img = new window.Image();
          img.onload = () => {
            const maxDim = 800;
            let w = img.width;
            let h = img.height;
            if (w > maxDim || h > maxDim) {
              if (w > h) {
                h = Math.round((h * maxDim) / w);
                w = maxDim;
              } else {
                w = Math.round((w * maxDim) / h);
                h = maxDim;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', 0.6));
          };
          img.onerror = () => resolve(rawDataUri);
          img.src = rawDataUri;
        });

        const [header, base64] = compressedUri.split(',');
        const mime = header.split(';')[0].replace('data:', '');
        return { base64, mimeType: mime, dataUri: compressedUri };
      }

      const [header, base64] = rawDataUri.split(',');
      const mime = header.split(';')[0].replace('data:', '');
      return { base64, mimeType: mime, dataUri: rawDataUri };
    } catch (e) {
      console.error('Image process error:', e);
    }
  }

  return null;
};
