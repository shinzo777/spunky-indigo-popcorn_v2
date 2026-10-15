import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  Linking,
  Alert,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { SOURCE_PLATFORMS } from '../constants';
import { detectSourcePlatform, getOfficialEmbedInfo } from '../helpers';

// =============================================================
// 要件3-3：アプリ内ブラウザ（SFSafariViewController / Chrome Custom Tabs）での遷移
// =============================================================
export const openCreatorUrlInAppBrowser = async (url, primaryColor = '#C85A17') => {
  if (!url || !url.trim()) return;
  let target = url.trim();
  if (!target.startsWith('http://') && !target.startsWith('https://')) {
    target = `https://${target}`;
  }

  try {
    const encodedUrl = encodeURI(target);
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.open(encodedUrl, '_blank', 'noopener,noreferrer');
      } else {
        await Linking.openURL(encodedUrl);
      }
      return;
    }

    await WebBrowser.openBrowserAsync(encodedUrl, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      controlsColor: primaryColor,
      showTitle: true,
      enableBarCollapsing: true,
    });
  } catch (err) {
    try {
      await Linking.openURL(encodeURI(target));
    } catch (fallbackErr) {
      const msg = '元のレシピページを開けませんでした。URLをご確認ください。';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('エラー', msg);
    }
  }
};

// =============================================================
// 要件3-1：レシピ詳細上部を重くしないコンパクトな「クリエイター・クレジットカード」
// オレンジ塗りつぶしを避け、白背景＋薄い枠線の洗練された横並びバーに整理
// =============================================================
export const CreatorCreditCard = ({
  sourceUrl,
  sourcePlatform,
  creatorName,
  ogpTitle,
  isScrapedAllowed = true,
  styles,
  theme,
  onOpenUrl,
}) => {
  const effectiveUrl = (sourceUrl || '').trim();
  const effectivePlatform =
    sourcePlatform && sourcePlatform !== 'manual'
      ? sourcePlatform
      : detectSourcePlatform(effectiveUrl);

  if (!effectiveUrl && !creatorName) {
    return null;
  }

  const platformConfig = SOURCE_PLATFORMS[effectivePlatform] || SOURCE_PLATFORMS.web;
  const displayCreator = creatorName && creatorName.trim() ? creatorName.trim() : platformConfig.label;

  const handlePress = () => {
    if (onOpenUrl) {
      onOpenUrl(effectiveUrl);
    } else {
      openCreatorUrlInAppBrowser(effectiveUrl, theme?.primary);
    }
  };

  return (
    <View style={styles.creatorCreditCard}>
      <View style={styles.creatorCreditTopRow}>
        <View style={styles.creatorPlatformIconWrap}>
          <Ionicons
            name={platformConfig.ionicon}
            size={18}
            color={theme?.primary || '#C85A17'}
          />
        </View>

        <View style={styles.creatorCreditInfoCol}>
          <View style={styles.creatorBadgeRow}>
            <Text style={styles.creatorNameText} numberOfLines={1}>
              考案者: {displayCreator} さん
            </Text>
            {!isScrapedAllowed ? (
              <View style={styles.bookmarkModeBadge}>
                <Text style={styles.bookmarkModeBadgeText}>ブックマーク</Text>
              </View>
            ) : null}
          </View>

          {ogpTitle ? (
            <Text style={styles.creatorOgpTitleText} numberOfLines={1}>
              {ogpTitle}
            </Text>
          ) : null}
        </View>

        {effectiveUrl ? (
          <TouchableOpacity
            style={styles.creatorCreditCtaBtn}
            onPress={handlePress}
            activeOpacity={0.75}
          >
            <Text style={styles.creatorCreditCtaBtnText}>元レシピ</Text>
            <Ionicons name="open-outline" size={13} color={theme?.primary || '#C85A17'} style={{ marginLeft: 3 }} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

// =============================================================
// 要件3-4：SNS公式埋め込み（Embed）プレイヤー（デフォルトは折りたたみで上部をスッキリ保つ）
// =============================================================
export const OfficialSocialEmbed = ({
  sourceUrl,
  sourcePlatform,
  creatorName,
  styles,
  theme,
  onOpenUrl,
}) => {
  // 詳細画面の上部が重くならないよう、初期状態はコンパクトな展開バーにし、タップで埋め込みを展開
  const [isExpanded, setIsExpanded] = useState(false);
  const embedInfo = getOfficialEmbedInfo(sourceUrl, sourcePlatform);

  if (!embedInfo) return null;

  const isYouTube = embedInfo.platform === 'youtube';
  const platformLabel = isYouTube ? 'YouTube公式プレイヤー' : 'Instagram公式埋め込み';
  const displayCreator = creatorName && creatorName.trim() ? creatorName.trim() : '考案者';

  const handleOpenInApp = () => {
    if (onOpenUrl) {
      onOpenUrl(sourceUrl);
    } else {
      openCreatorUrlInAppBrowser(sourceUrl, theme?.primary);
    }
  };

  let NativeWebView = null;
  if (Platform.OS !== 'web') {
    try {
      // eslint-disable-next-line global-require
      NativeWebView = require('react-native-webview').WebView;
    } catch (e) {
      NativeWebView = null;
    }
  }

  return (
    <View style={styles.socialEmbedContainer}>
      <TouchableOpacity
        style={styles.socialEmbedToggleRow}
        onPress={() => setIsExpanded(!isExpanded)}
        activeOpacity={0.75}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Ionicons
            name={isYouTube ? 'play-circle-outline' : 'videocam-outline'}
            size={17}
            color={theme?.primary || '#C85A17'}
            style={{ marginRight: 6 }}
          />
          <Text style={styles.socialEmbedToggleText}>
            {platformLabel}を{isExpanded ? '閉じる' : '開く'}
          </Text>
        </View>
        <Ionicons
          name={isExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}
          size={16}
          color={theme?.textMuted || '#6E5648'}
        />
      </TouchableOpacity>

      {isExpanded ? (
        <View style={styles.socialEmbedBody}>
          {Platform.OS === 'web' ? (
            <View
              style={[
                styles.socialEmbedFrameWrapper,
                !isYouTube && { height: 400 },
              ]}
            >
              {React.createElement('iframe', {
                src: embedInfo.embedUrl,
                title: `${displayCreator} - ${platformLabel}`,
                style: {
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  borderRadius: '8px',
                },
                allow:
                  'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
                allowFullScreen: true,
              })}
            </View>
          ) : NativeWebView ? (
            <View
              style={[
                styles.socialEmbedFrameWrapper,
                !isYouTube && { height: 400 },
              ]}
            >
              <NativeWebView
                source={{ uri: embedInfo.embedUrl }}
                style={{ flex: 1, borderRadius: 8 }}
                allowsInlineMediaPlayback
                javaScriptEnabled
                domStorageEnabled
              />
            </View>
          ) : (
            <View style={styles.socialEmbedFallbackBox}>
              <Text style={styles.socialEmbedFallbackDesc}>
                アプリ内ブラウザで{displayCreator}さんの公式動画・投稿を再生します。
              </Text>
              <TouchableOpacity
                style={styles.socialEmbedOpenBtn}
                onPress={handleOpenInApp}
                activeOpacity={0.8}
              >
                <Text style={styles.socialEmbedOpenBtnText}>公式プレイヤーを開く</Text>
              </TouchableOpacity>
            </View>
          )}
          <Text style={styles.socialEmbedCaption}>
            公式プレイヤーでの再生は{displayCreator}さんの再生数・インサイトに還元されます
          </Text>
        </View>
      ) : null}
    </View>
  );
};

// =============================================================
// 要件3-2：調理手順エリア下部の「コツ・写真確認」誘導バナー
// =============================================================
export const CreatorTipsBanner = ({
  sourceUrl,
  sourcePlatform,
  creatorName,
  styles,
  theme,
  onOpenUrl,
}) => {
  const effectiveUrl = (sourceUrl || '').trim();
  const effectivePlatform =
    sourcePlatform && sourcePlatform !== 'manual'
      ? sourcePlatform
      : detectSourcePlatform(effectiveUrl);

  if (!effectiveUrl && effectivePlatform === 'manual') {
    return null;
  }

  const displayCreator = creatorName && creatorName.trim() ? creatorName.trim() : '考案者';

  const handlePress = () => {
    if (onOpenUrl) {
      onOpenUrl(effectiveUrl);
    } else {
      openCreatorUrlInAppBrowser(effectiveUrl, theme?.primary);
    }
  };

  return (
    <View style={styles.creatorTipsBanner}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: effectiveUrl ? 10 : 0 }}>
        <Ionicons
          name="bulb-outline"
          size={17}
          color={theme?.primary || '#C85A17'}
          style={{ marginRight: 6, marginTop: 1 }}
        />
        <Text style={styles.creatorTipsBannerText}>
          {displayCreator}さん直伝の「失敗しないコツ」や工程写真・動画は元記事でチェック！
        </Text>
      </View>
      {effectiveUrl ? (
        <TouchableOpacity
          style={styles.creatorTipsBannerBtn}
          onPress={handlePress}
          activeOpacity={0.75}
        >
          <Text style={styles.creatorTipsBannerBtnText}>
            元記事・動画で詳しいコツを見る
          </Text>
          <Ionicons name="open-outline" size={14} color={theme?.primary || '#C85A17'} style={{ marginLeft: 4 }} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

// =============================================================
// 要件4：調理完了時・家族評価登録時の「作レポ・応援（エンゲージメント還元）」アクション
// =============================================================
export const CreatorSupportActionCard = ({
  sourceUrl,
  sourcePlatform,
  creatorName,
  styles,
  theme,
  onOpenUrl,
}) => {
  const effectiveUrl = (sourceUrl || '').trim();
  const effectivePlatform =
    sourcePlatform && sourcePlatform !== 'manual'
      ? sourcePlatform
      : detectSourcePlatform(effectiveUrl);

  if (!effectiveUrl && !creatorName) {
    return null;
  }

  const displayCreator = creatorName && creatorName.trim() ? creatorName.trim() : '考案者';
  const platformConfig = SOURCE_PLATFORMS[effectivePlatform] || SOURCE_PLATFORMS.web;

  const handlePress = () => {
    if (onOpenUrl) {
      onOpenUrl(effectiveUrl);
    } else {
      openCreatorUrlInAppBrowser(effectiveUrl, theme?.primary);
    }
  };

  return (
    <View style={styles.creatorSupportCard}>
      <View style={styles.creatorSupportHeaderRow}>
        <Ionicons
          name="heart-outline"
          size={18}
          color={theme?.accentSage || '#4A7860'}
          style={{ marginRight: 8, marginTop: 1 }}
        />
        <Text style={styles.creatorSupportMessage}>
          {displayCreator}さんの元投稿に「いいね」や保存をして応援しよう！
        </Text>
      </View>

      {effectiveUrl ? (
        <TouchableOpacity
          style={styles.creatorSupportBtn}
          onPress={handlePress}
          activeOpacity={0.8}
        >
          <Ionicons name={platformConfig.ionicon} size={15} color={theme?.accentSage || '#4A7860'} style={{ marginRight: 6 }} />
          <Text style={styles.creatorSupportBtnText}>
            元のSNS投稿・記事を開く
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};
