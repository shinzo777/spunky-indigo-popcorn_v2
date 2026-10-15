/**
 * Cloudflare Worker (wagaya-no-recipe-api)
 * クリエイター還元・出典明記および著作権配慮型レシピ抽出対応プロキシ
 *
 * 主な役割:
 * 1. robots.txt / meta robots (noarchive, noai) の検証による isScrapedAllowed 判定
 * 2. OGPメタデータ (og:title, og:site_name, author) からの creatorName / ogpTitle 抽出
 * 3. 著作権配慮・超要約化システムプロンプト（1ステップ40文字以内の動詞インデックス・画像URL非保存）の強制
 */

import { RECIPE_EXTRACTION_SYSTEM_PROMPT } from './constants';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-App-Token',
};

const extractMetaContent = (html, pattern) => {
  const match = html.match(pattern);
  return match ? match[1].trim() : null;
};

const checkRobotsTxtAllowed = async (targetUrl) => {
  try {
    const u = new URL(targetUrl);
    const robotsUrl = `${u.protocol}//${u.host}/robots.txt`;
    const res = await fetch(robotsUrl, { method: 'GET' });
    if (!res.ok) return true;
    const txt = (await res.text()).toLowerCase();
    // User-agent: * で Disallow: / が指定されている場合はスクレイピング不可と判定
    const starSection = txt.split(/user-agent:\s*\*/i)[1]?.split(/user-agent:/i)[0] || '';
    if (/disallow:\s*\/\s*$/m.test(starSection)) {
      return false;
    }
    return true;
  } catch {
    return true;
  }
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const token = request.headers.get('X-App-Token');
    if (token !== 'wagaya-recipe-2026-secret-token') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    try {
      const body = await request.json();
      const { webUrl, base64Data, mimeType, systemPrompt } = body;
      const activeSystemPrompt = systemPrompt || RECIPE_EXTRACTION_SYSTEM_PROMPT;

      let ogpTitle = null;
      let creatorName = null;
      let isScrapedAllowed = true;
      let cleanedPageText = '';

      if (webUrl) {
        const robotsAllowed = await checkRobotsTxtAllowed(webUrl);
        const pageRes = await fetch(webUrl, {
          headers: { 'User-Agent': 'MeppyRecipeBot/1.0 (+https://meppy.app)' },
        });
        const html = await pageRes.text();

        const metaRobots =
          extractMetaContent(
            html,
            /<meta[^>]+name=["'](?:robots|googlebot)["'][^>]+content=["']([^"']+)["']/i
          ) || '';
        if (
          !robotsAllowed ||
          /noarchive|noai|noimageai|noindex/i.test(metaRobots)
        ) {
          isScrapedAllowed = false;
        }

        ogpTitle =
          extractMetaContent(
            html,
            /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i
          ) ||
          extractMetaContent(html, /<title[^>]*>([^<]+)<\/title>/i);

        creatorName =
          extractMetaContent(
            html,
            /<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["']/i
          ) ||
          extractMetaContent(
            html,
            /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i
          );

        if (!isScrapedAllowed) {
          return new Response(
            JSON.stringify({
              meta: { ogpTitle, creatorName, isScrapedAllowed: false },
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        text: JSON.stringify({
                          title: ogpTitle || 'ブックマークレシピ',
                          creatorName,
                          ogpTitle,
                          isScrapedAllowed: false,
                          ingredients: [],
                          steps: [],
                        }),
                      },
                    ],
                  },
                },
              ],
            }),
            { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
          );
        }

        // 画像タグ・スクリプト等を完全に除去してテキストのみ抽出（画像の非保存徹底）
        cleanedPageText = html
          .replace(/<script[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style[\s\S]*?<\/style>/gi, ' ')
          .replace(/<img[^>]*>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 18000);
      }

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;
      const userParts = webUrl
        ? [
            {
              text: `取得元URL: ${webUrl}\nOGPタイトル: ${ogpTitle || '不明'}\nメタデータ著者/サイト名: ${creatorName || '不明'}\n\nページテキスト:\n${cleanedPageText}`,
            },
          ]
        : [
            { inlineData: { mimeType: mimeType || 'image/jpeg', data: base64Data } },
            { text: 'この画像から著作権配慮ルールに従いレシピ事実データ（材料と40文字以内の手順インデックス、考案者名）のみをJSON形式で抽出してください。' },
          ];

      const geminiRes = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: activeSystemPrompt }] },
          contents: [{ role: 'user', parts: userParts }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
        }),
      });

      const geminiJson = await geminiRes.json();
      return new Response(
        JSON.stringify({
          ...geminiJson,
          meta: { ogpTitle, creatorName, isScrapedAllowed },
        }),
        {
          status: geminiRes.status,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        }
      );
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
  },
};
