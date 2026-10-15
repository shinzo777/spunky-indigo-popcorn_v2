import { Platform } from 'react-native';
import { STAPLE_SEASONINGS_REGEX } from './constants';

const CIRCLED_NUMBERS = [
  '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩',
  '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳',
];

// =============================================================
// 要件1：URLのドメインから sourcePlatform を自動判定
// 'youtube' | 'instagram' | 'x' | 'web' | 'manual'
// =============================================================
export const detectSourcePlatform = (url) => {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return 'manual';
  }
  let normalized = url.trim();
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `https://${normalized}`;
  }
  try {
    const parsed = new URL(normalized);
    const host = parsed.hostname.toLowerCase();
    if (host.includes('youtube.com') || host.includes('youtu.be')) {
      return 'youtube';
    }
    if (host.includes('instagram.com') || host.includes('instagr.am')) {
      return 'instagram';
    }
    if (
      host === 'x.com' ||
      host.endsWith('.x.com') ||
      host.includes('twitter.com') ||
      host === 't.co'
    ) {
      return 'x';
    }
    return 'web';
  } catch (e) {
    const lower = normalized.toLowerCase();
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
    if (lower.includes('instagram.com')) return 'instagram';
    if (lower.includes('x.com/') || lower.includes('twitter.com/')) return 'x';
    return 'web';
  }
};

// =============================================================
// 要件1：URLのドメイン・パスからデフォルトのサイト/アカウント名を推定（フォールバック用）
// =============================================================
export const inferCreatorNameFromUrl = (url) => {
  if (!url || typeof url !== 'string' || !url.trim()) return null;
  let normalized = url.trim();
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `https://${normalized}`;
  }
  try {
    const parsed = new URL(normalized);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const pathParts = parsed.pathname.split('/').filter(Boolean);

    if (host.includes('youtube.com') || host.includes('youtu.be')) {
      const handlePart = pathParts.find((p) => p.startsWith('@'));
      if (handlePart) return handlePart;
      return null;
    }
    if (host.includes('instagram.com')) {
      if (pathParts.length > 0 && !['p', 'reel', 'reels', 'tv', 'stories'].includes(pathParts[0])) {
        return `@${pathParts[0].replace(/^@/, '')}`;
      }
      return null;
    }
    if (host === 'x.com' || host.includes('twitter.com')) {
      if (pathParts.length > 0 && !['i', 'intent', 'search', 'home', 'explore'].includes(pathParts[0])) {
        return `@${pathParts[0].replace(/^@/, '')}`;
      }
      return null;
    }
    if (host.includes('cookpad.com')) return 'クックパッド';
    if (host.includes('oceans-nadia.com')) return 'Nadia (ナディア)';
    if (host.includes('kurashiru.com')) return 'クラシル';
    if (host.includes('delishkitchen.tv')) return 'DELISH KITCHEN';
    if (host.includes('sirogohan.com')) return '白ごはん.com';
    if (host.includes('orangepage.net')) return 'オレンジページnet';
    if (host.includes('lettuceclub.net')) return 'レタスクラブ';
    if (host.includes('macaro-ni.jp')) return 'macaroni';
    if (host.includes('recipe.rakuten.co.jp')) return '楽天レシピ';
    return host;
  } catch (e) {
    return null;
  }
};

// =============================================================
// 要件1：既存レシピデータとの後方互換性を保つ正規化関数
// =============================================================
export const normalizeRecipeRecord = (recipe) => {
  if (!recipe) return recipe;
  const rawSourceUrl = (recipe.sourceUrl ?? recipe.webUrl ?? '').trim();
  const sourcePlatform =
    recipe.sourcePlatform && recipe.sourcePlatform !== 'manual'
      ? recipe.sourcePlatform
      : detectSourcePlatform(rawSourceUrl);
  const creatorName =
    recipe.creatorName !== undefined && recipe.creatorName !== ''
      ? recipe.creatorName
      : inferCreatorNameFromUrl(rawSourceUrl);
  const ogpTitle = recipe.ogpTitle ?? null;
  const isScrapedAllowed =
    typeof recipe.isScrapedAllowed === 'boolean' ? recipe.isScrapedAllowed : true;

  return {
    ...recipe,
    sourceUrl: rawSourceUrl,
    webUrl: rawSourceUrl, // 既存フィールドとの互換維持
    sourcePlatform,
    creatorName: creatorName || null,
    ogpTitle,
    isScrapedAllowed,
  };
};

// =============================================================
// 要件2：調理手順の1行超要約インデックス化（最大40文字程度）
// =============================================================
export const formatStepAsConciseIndex = (rawStep, index) => {
  if (!rawStep) return '';
  const prefix = CIRCLED_NUMBERS[index] || `${index + 1}.`;
  let cleaned = String(rawStep)
    .replace(/^(?:step\s*\d+|手順\s*\d+|\d+[\.\、\)\s]+|[①-⑳]\s*)/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  // コツ・ポイント等の補足文が混入している場合は最初の文のみ抽出してインデックス化
  const sentenceParts = cleaned.split(/[。！？]/).filter((s) => s.trim().length > 0);
  if (sentenceParts.length > 0) {
    cleaned = sentenceParts[0].trim();
  }

  const MAX_STEP_CHARS = 40;
  if (cleaned.length > MAX_STEP_CHARS) {
    cleaned = `${cleaned.slice(0, MAX_STEP_CHARS - 1)}…`;
  }

  return `${prefix} ${cleaned}`;
};

// =============================================================
// 要件2：AI抽出レスポンス（JSONまたはテキスト）の解析・正規化
// =============================================================
export const parseAiExtractionResponse = (rawResponseText, sourceUrl = '', apiMeta = {}) => {
  const sourcePlatform = detectSourcePlatform(sourceUrl);
  const fallbackCreator = inferCreatorNameFromUrl(sourceUrl);

  // API側で明示的に isScrapedAllowed === false が返された場合（ブックマークモード）
  if (apiMeta && apiMeta.isScrapedAllowed === false) {
    const fallbackTitle = apiMeta.ogpTitle || 'ブックマークしたレシピ';
    return {
      title: fallbackTitle,
      creatorName: apiMeta.creatorName || fallbackCreator,
      ogpTitle: apiMeta.ogpTitle || null,
      sourceUrl,
      sourcePlatform,
      isScrapedAllowed: false,
      cookingTime: 15,
      category: '主菜',
      extractedText: '',
    };
  }

  if (!rawResponseText || typeof rawResponseText !== 'string') {
    return null;
  }

  // JSONオブジェクトの抽出を試みる
  const jsonMatch = rawResponseText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      const isScrapedAllowed =
        typeof parsed.isScrapedAllowed === 'boolean' ? parsed.isScrapedAllowed : true;
      const creatorName = parsed.creatorName || apiMeta?.creatorName || fallbackCreator || null;
      const ogpTitle = parsed.ogpTitle || apiMeta?.ogpTitle || null;
      const recipeTitle =
        (parsed.title || ogpTitle || '無題のレシピ').replace(/[#*]/g, '').trim();

      if (!isScrapedAllowed) {
        return {
          title: recipeTitle,
          creatorName,
          ogpTitle,
          sourceUrl,
          sourcePlatform,
          isScrapedAllowed: false,
          cookingTime: Number(parsed.cookingTime) || 15,
          category: parsed.category || '主菜',
          extractedText: '',
        };
      }

      const ingLines = Array.isArray(parsed.ingredients)
        ? parsed.ingredients
            .map((ing) => {
              if (typeof ing === 'string') {
                return `・${ing.replace(/^[・\-\*•\s]+/, '').trim()}`;
              }
              const name = (ing?.name || '').trim();
              const amount = (ing?.amount || '').trim();
              const unit = (ing?.unit || '').trim();
              if (!name) return null;
              const qty = `${amount}${unit}`.trim();
              return qty ? `・${name}：${qty}` : `・${name}`;
            })
            .filter(Boolean)
        : [];

      const stepLines = Array.isArray(parsed.steps)
        ? parsed.steps
            .map((step, idx) => formatStepAsConciseIndex(step, idx))
            .filter(Boolean)
        : [];

      const formattedText = [
        recipeTitle,
        '【材料】（2人分）',
        ...(ingLines.length > 0 ? ingLines : ['・材料情報は元レシピをご確認ください']),
        '【作り方】',
        ...(stepLines.length > 0 ? stepLines : ['① 詳しい手順は元レシピをご確認ください']),
      ].join('\n');

      return {
        title: recipeTitle,
        creatorName,
        ogpTitle,
        sourceUrl,
        sourcePlatform,
        isScrapedAllowed: true,
        cookingTime: Number(parsed.cookingTime) || 15,
        category: parsed.category || '主菜',
        extractedText: formattedText,
      };
    } catch (e) {
      // JSONパース失敗時は下のテキスト正規化フォールバックへ進む
    }
  }

  // 従来のプレーンテキスト形式が返ってきた場合でも、著作権配慮（40文字インデックス要約）を適用する
  const lines = rawResponseText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const autoTitle = lines[0]?.replace(/[#*]/g, '').trim() || apiMeta?.ogpTitle || '無題のレシピ';

  let detectedCreator = apiMeta?.creatorName || fallbackCreator || null;
  const normalizedLines = [];
  let inSteps = false;
  let stepCounter = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // 考案者・著者行があれば抽出
    const creatorMatch = line.match(/^(?:考案者|著者|作者|クリエイター|チャンネル名|アカウント)[：:]\s*(.+)$/);
    if (creatorMatch) {
      detectedCreator = creatorMatch[1].trim();
      continue;
    }
    // コツ・ポイント・コラム行は除外（元サイトへの動機を残すため）
    if (/^(?:【?(?:コツ|ポイント|アドバイス|コラム|エピソード)】?)/.test(line)) {
      break;
    }
    if (/作り方|手順|【作り方】|〔作り方〕|＜作り方＞/.test(line)) {
      inSteps = true;
      normalizedLines.push('【作り方】');
      continue;
    }
    if (inSteps) {
      normalizedLines.push(formatStepAsConciseIndex(line, stepCounter));
      stepCounter += 1;
    } else {
      normalizedLines.push(line);
    }
  }

  return {
    title: autoTitle,
    creatorName: detectedCreator,
    ogpTitle: apiMeta?.ogpTitle || null,
    sourceUrl,
    sourcePlatform,
    isScrapedAllowed: true,
    cookingTime: 15,
    category: '主菜',
    extractedText: normalizedLines.join('\n'),
  };
};

// =============================================================
// 要件3-4：YouTube / Instagram 公式埋め込み（Embed）URLの生成
// =============================================================
export const getOfficialEmbedInfo = (sourceUrl, sourcePlatform) => {
  if (!sourceUrl || typeof sourceUrl !== 'string') return null;
  let normalized = sourceUrl.trim();
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `https://${normalized}`;
  }

  const platform = sourcePlatform || detectSourcePlatform(normalized);

  if (platform === 'youtube') {
    try {
      const u = new URL(normalized);
      let videoId = null;
      if (u.hostname.includes('youtu.be')) {
        videoId = u.pathname.split('/').filter(Boolean)[0];
      } else if (u.pathname.includes('/shorts/')) {
        videoId = u.pathname.split('/shorts/')[1]?.split(/[/?#]/)[0];
      } else if (u.pathname.includes('/embed/')) {
        videoId = u.pathname.split('/embed/')[1]?.split(/[/?#]/)[0];
      } else {
        videoId = u.searchParams.get('v');
      }
      if (videoId) {
        return {
          platform: 'youtube',
          id: videoId,
          embedUrl: `https://www.youtube.com/embed/${videoId}?playsinline=1&rel=0`,
          watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
        };
      }
    } catch (e) {
      return null;
    }
  }

  if (platform === 'instagram') {
    try {
      const u = new URL(normalized);
      const match = u.pathname.match(/\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
      if (match) {
        const type = match[1] === 'reels' ? 'reel' : match[1];
        const shortcode = match[2];
        return {
          platform: 'instagram',
          id: shortcode,
          embedUrl: `https://www.instagram.com/${type}/${shortcode}/embed`,
          watchUrl: `https://www.instagram.com/${type}/${shortcode}/`,
        };
      }
    } catch (e) {
      return null;
    }
  }

  return null;
};

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
