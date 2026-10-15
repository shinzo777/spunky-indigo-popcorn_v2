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
// 元サイトの1PV（Google Analytics等のインサイト）を確実にカウントしつつMeppy内で開く
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
// 要件3-1：ヘッダー直下の「クリエイター・クレジットカード」 (CreatorCreditCard)
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

  // URLもクリエイター名も存在しない完全な手動レシピの場合は非表示
  if (!effectiveUrl && !creatorName) {
    return null;
  }

  const platformConfig = SOURCE_PLATFORMS[effectivePlatform] || SOURCE_PLATFORMS.web;
  const displayCreator = creatorName && creatorName.trim() ? creatorName.trim() : 'レシピ考案者';

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
        <View
          style={[
            styles.creatorPlatformIconWrap,
            { backgroundColor: theme?.isDark ? '#2C221E' : platformConfig.bgLight },
          ]}
        >
          <Ionicons
            name={platformConfig.ionicon}
            size={22}
            color={platformConfig.accentColor}
          />
        </View>

        <View style={styles.creatorCreditInfoCol}>
          <View style={styles.creatorBadgeRow}>
            <View
              style={[
                styles.creatorPlatformBadge,
                { borderColor: platformConfig.accentColor },
              ]}
            >
              <Text
                style={[
                  styles.creatorPlatformBadgeText,
                  { color: platformConfig.accentColor },
                ]}
              >
                {platformConfig.icon} {platformConfig.label}
              </Text>
            </View>
            {!isScrapedAllowed ? (
              <View style={styles.bookmarkModeBadge}>
                <Text style={styles.bookmarkModeBadgeText}>🔖 ブックマーク保護</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.creatorNameText} numberOfLines={1}>
            考案者：{displayCreator} さん
          </Text>

          {ogpTitle ? (
            <Text style={styles.creatorOgpTitleText} numberOfLines={1}>
              出典元：{ogpTitle}
            </Text>
          ) : null}
        </View>
      </View>

      {effectiveUrl ? (
        <TouchableOpacity
          style={[
            styles.creatorCreditCtaBtn,
            { backgroundColor: platformConfig.accentColor },
          ]}
          onPress={handlePress}
          activeOpacity={0.82}
        >
          <Ionicons name="open-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.creatorCreditCtaBtnText}>元のレシピ・動画を見る</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

// =============================================================
// 要件3-4：SNS公式埋め込み（Embed）プレイヤー（YouTube / Instagram対応）
// =============================================================
export const OfficialSocialEmbed = ({
  sourceUrl,
  sourcePlatform,
  creatorName,
  styles,
  theme,
  onOpenUrl,
}) => {
  const [activeTab, setActiveTab] = useState('embed'); // 'embed' | 'summary'
  const embedInfo = getOfficialEmbedInfo(sourceUrl, sourcePlatform);

  if (!embedInfo) return null;

  const isYouTube = embedInfo.platform === 'youtube';
  const platformLabel = isYouTube ? 'YouTube公式プレイヤー' : 'Instagram公式埋め込み';
  const displayCreator = creatorName && creatorName.trim() ? creatorName.trim() : 'クリエイター';

  const handleOpenInApp = () => {
    if (onOpenUrl) {
      onOpenUrl(sourceUrl);
    } else {
      openCreatorUrlInAppBrowser(sourceUrl, theme?.primary);
    }
  };

  // ネイティブ環境で react-native-webview が利用可能か動的チェック
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
      <View style={styles.socialEmbedTabRow}>
        <TouchableOpacity
          style={[
            styles.socialEmbedTabBtn,
            activeTab === 'embed' && styles.socialEmbedTabBtnActive,
          ]}
          onPress={() => setActiveTab('embed')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.socialEmbedTabText,
              activeTab === 'embed' && styles.socialEmbedTabTextActive,
            ]}
          >
            🎬 {platformLabel}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.socialEmbedTabBtn,
            activeTab === 'summary' && styles.socialEmbedTabBtnActive,
          ]}
          onPress={() => setActiveTab('summary')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.socialEmbedTabText,
              activeTab === 'summary' && styles.socialEmbedTabTextActive,
            ]}
          >
            📖 プレイヤーを折りたたむ
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'embed' ? (
        <View style={styles.socialEmbedBody}>
          {Platform.OS === 'web' ? (
            <View
              style={[
                styles.socialEmbedFrameWrapper,
                !isYouTube && { height: 440 },
              ]}
            >
              {React.createElement('iframe', {
                src: embedInfo.embedUrl,
                title: `${displayCreator} - ${platformLabel}`,
                style: {
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  borderRadius: '14px',
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
                !isYouTube && { height: 440 },
              ]}
            >
              <NativeWebView
                source={{ uri: embedInfo.embedUrl }}
                style={{ flex: 1, borderRadius: 14 }}
                allowsInlineMediaPlayback
                javaScriptEnabled
                domStorageEnabled
              />
            </View>
          ) : (
            <View style={styles.socialEmbedFallbackBox}>
              <Text style={styles.socialEmbedFallbackTitle}>
                {isYouTube ? '▶️ YouTube公式動画' : '📸 Instagram公式投稿'}（{displayCreator}さん）
              </Text>
              <Text style={styles.socialEmbedFallbackDesc}>
                アプリ内ブラウザで公式プレイヤーを開き、クリエイターの再生数・インサイトへ直接還元します。
              </Text>
              <TouchableOpacity
                style={styles.socialEmbedOpenBtn}
                onPress={handleOpenInApp}
                activeOpacity={0.85}
              >
                <Text style={styles.socialEmbedOpenBtnText}>
                  アプリ内プレイヤーで再生する
                </Text>
              </TouchableOpacity>
            </View>
          )}
          <Text style={styles.socialEmbedCaption}>
            ※公式埋め込みプレイヤーでの再生は、{displayCreator}さんの公式再生数・インサイトに直結します
          </Text>
        </View>
      ) : null}
    </View>
  );
};

// =============================================================
// 要件3-2：調理手順エリア下部の「コツ・写真確認」誘導バナー (CreatorTipsBanner)
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
      <Text style={styles.creatorTipsBannerText}>
        💡 {displayCreator}さん直伝の『失敗しないコツ』や工程写真・動画は元記事でチェック！
      </Text>
      {effectiveUrl ? (
        <TouchableOpacity
          style={styles.creatorTipsBannerBtn}
          onPress={handlePress}
          activeOpacity={0.82}
        >
          <Ionicons name="book-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.creatorTipsBannerBtnText}>
            元記事・動画で詳しいコツを見る
          </Text>
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
        <Text style={styles.creatorSupportEmoji}>🙌</Text>
        <Text style={styles.creatorSupportMessage}>
          {displayCreator}さんの元投稿に『いいね』や保存をして応援しよう！
        </Text>
      </View>

      {effectiveUrl ? (
        <TouchableOpacity
          style={styles.creatorSupportBtn}
          onPress={handlePress}
          activeOpacity={0.85}
        >
          <Ionicons name={platformConfig.ionicon} size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.creatorSupportBtnText}>
            元のSNS投稿・記事を開く
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};
