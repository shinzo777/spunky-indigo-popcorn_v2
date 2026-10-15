/* eslint-disable react-native/no-unused-styles */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  Pressable,
  Animated,
  Image,
  ScrollView,
  TextInput,
  ActivityIndicator,
  FlatList,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Modal,
  Share,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

import {
  FIREBASE_PROJECT_ID,
  AI_PROXY_API_URL,
  APP_SECRET_TOKEN,
  THEMES,
  MONTHLY_SEASONAL_MAP,
  CATEGORIES,
  DEFAULT_MEMBERS,
  RATING_STARS,
  SHOPPING_AISLES,
  PRESET_DEFAULT_RECIPES,
  NAV_ITEMS,
  SOURCE_PLATFORMS,
  RECIPE_EXTRACTION_SYSTEM_PROMPT,
  WEEKDAY_LABELS,
  getSeasonIcon,
} from './constants';

import {
  categorizeIngredient,
  extractIngredientsFromRecipeText,
  generateNewFamilyId,
  formatRelativeDate,
  processAssetForUpload,
  compressImageForFirestore,
  detectSourcePlatform,
  inferCreatorNameFromUrl,
  normalizeRecipeRecord,
  parseAiExtractionResponse,
  parseStructuredRecipeSections,
  toDateKey,
  formatDateKeyJapanese,
  pruneCookingHistoryOneYear,
  generateCalendarMonthWeeks,
} from './helpers';

import {
  CreatorCreditCard,
  OfficialSocialEmbed,
  CreatorTipsBanner,
  CreatorSupportActionCard,
  openCreatorUrlInAppBrowser,
} from './components/CreatorAttribution';

import { getStyles } from './styles';

// =============================================================
// タップ時の控えめなフィードバックカード
// =============================================================
const SpringCard = ({ children, onPress, style, ...props }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.985,
      friction: 8,
      tension: 100,
      useNativeDriver: false,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 80,
      useNativeDriver: false,
    }).start();
  };

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      style={style}
      {...props}
    >
      <Animated.View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', transform: [{ scale: scaleAnim }] }}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

// =============================================================
// ナビゲーションバーのタブボタン
// =============================================================
const NavTabButton = ({ tab, currentTab, onPress, styles, unboughtCount, theme }) => {
  const isActive = currentTab === tab.key;

  return (
    <Pressable onPress={onPress} style={{ flex: 1 }}>
      <View style={styles.navTabItem}>
        <View style={{ position: 'relative' }}>
          <Ionicons
            name={isActive ? tab.activeIconName : tab.iconName}
            size={20}
            color={isActive ? theme.primary : theme.textMuted}
          />
          {tab.key === 'shopping' && unboughtCount > 0 ? (
            <View style={styles.navBadge}>
              <Text style={styles.navBadgeText}>{unboughtCount}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.navTabLabel, isActive && styles.navTabLabelActive]}>
          {tab.label}
        </Text>
      </View>
    </Pressable>
  );
};

export default function App() {
  const now = new Date();
  const todayDateKey = toDateKey(now);

  const [cloudRecipes, setCloudRecipes] = useState([]);
  const [currentTab, setCurrentTab] = useState('home');
  const [activeSubView, setActiveSubView] = useState(null); // null | 'detail' | 'edit'

  // カレンダー＆調理履歴ステート（直近1年分保管）
  const [cookingHistory, setCookingHistory] = useState([]);
  const [calendarYear, setCalendarYear] = useState(now.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(now.getMonth()); // 0〜11
  const [selectedCalendarDateKey, setSelectedCalendarDateKey] = useState(todayDateKey);

  // タブ・サブ画面遷移アニメーション
  const tabFadeAnim = useRef(new Animated.Value(1)).current;
  const tabTranslateY = useRef(new Animated.Value(0)).current;
  const subViewFadeAnim = useRef(new Animated.Value(0)).current;
  const subViewSlideAnim = useRef(new Animated.Value(16)).current;

  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // モーダルステート
  const [isAddMenuVisible, setIsAddMenuVisible] = useState(false);
  const [isUrlModalVisible, setIsUrlModalVisible] = useState(false);
  const [importUrlText, setImportUrlText] = useState('');
  const [isCookingCompleteModalVisible, setIsCookingCompleteModalVisible] = useState(false);
  const [completedRecipe, setCompletedRecipe] = useState(null);

  const [familyId, setFamilyId] = useState('');
  const [joinFamilyInput, setJoinFamilyInput] = useState('');

  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isRequestEnabled, setIsRequestEnabled] = useState(true);
  const [isCookingModeEnabled, setIsCookingModeEnabled] = useState(true);
  const [isHeadlineEnabled, setIsHeadlineEnabled] = useState(true);
  const [isShowDefaultRecipes, setIsShowDefaultRecipes] = useState(true);
  const [isCookedButtonEnabled, setIsCookedButtonEnabled] = useState(true);
  const [isExcludeStapleSeasonings, setIsExcludeStapleSeasonings] = useState(true);
  const [members, setMembers] = useState(DEFAULT_MEMBERS);

  const [isAppReady, setIsAppReady] = useState(false);

  const [shoppingList, setShoppingList] = useState([]);
  const [manualItemInput, setManualItemInput] = useState('');

  const [filterMode, setFilterMode] = useState('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [editingRecipeId, setEditingRecipeId] = useState(null);
  const [isEditingDefault, setIsEditingDefault] = useState(false);
  const [isCookedState, setIsCookedState] = useState(false);
  const [category, setCategory] = useState('主菜');
  const [familyRatings, setFamilyRatings] = useState({});
  const [foodImageUri, setFoodImageUri] = useState(null);

  // 要件1：出典・クリエイター情報ステート
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourcePlatform, setSourcePlatform] = useState('manual');
  const [creatorName, setCreatorName] = useState('');
  const [ogpTitle, setOgpTitle] = useState('');
  const [isScrapedAllowed, setIsScrapedAllowed] = useState(true);

  const [title, setTitle] = useState('');
  const [extractedText, setExtractedText] = useState('');
  const [notes, setNotes] = useState('');
  const [cookingTime, setCookingTime] = useState(15);
  const [isBento, setIsBento] = useState(false);
  const [isMealPrep, setIsMealPrep] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  const [isCookingMode, setIsCookingMode] = useState(false);
  const [checkedSteps, setCheckedSteps] = useState({});
  const [checkedIngredients, setCheckedIngredients] = useState({});
  const [servingSize, setServingSize] = useState(2);

  const theme = isDarkMode ? THEMES.dark : THEMES.light;
  const styles = useMemo(() => getStyles(theme), [theme]);

  const currentMonth = now.getMonth() + 1;
  const currentSeasonIconName = getSeasonIcon(currentMonth);
  const currentSeasonalText = MONTHLY_SEASONAL_MAP[currentMonth] || '';
  const todayDayOfWeek = WEEKDAY_LABELS[now.getDay()];
  const todayDateString = `${currentMonth}/${now.getDate()}(${todayDayOfWeek})`;

  const firestoreFamilyApiUrl = useMemo(() => {
    if (!FIREBASE_PROJECT_ID || !familyId) return null;
    return `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/families/${familyId}/recipes`;
  }, [familyId]);

  const firestoreShoppingApiUrl = useMemo(() => {
    if (!FIREBASE_PROJECT_ID || !familyId) return null;
    return `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/families/${familyId}/shopping/list`;
  }, [familyId]);

  const firestoreCalendarApiUrl = useMemo(() => {
    if (!FIREBASE_PROJECT_ID || !familyId) return null;
    return `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/families/${familyId}/shopping/calendar_history`;
  }, [familyId]);

  const allRecipes = useMemo(() => {
    if (!isShowDefaultRecipes) {
      return cloudRecipes.filter((r) => !r.isDefault).map(normalizeRecipeRecord);
    }
    const presetMap = new Map();
    PRESET_DEFAULT_RECIPES.forEach((p) => presetMap.set(p.id, normalizeRecipeRecord(p)));
    cloudRecipes.forEach((r) => presetMap.set(r.id, normalizeRecipeRecord(r)));
    return Array.from(presetMap.values());
  }, [cloudRecipes, isShowDefaultRecipes]);

  const handleSourceUrlChange = (val) => {
    setSourceUrl(val);
    const detected = detectSourcePlatform(val);
    setSourcePlatform(detected);
    if (!creatorName || !creatorName.trim()) {
      const inferred = inferCreatorNameFromUrl(val);
      if (inferred) setCreatorName(inferred);
    }
  };

  const switchTabSmoothly = (newTab) => {
    if (newTab === currentTab) return;
    tabFadeAnim.setValue(0.4);
    tabTranslateY.setValue(6);
    setCurrentTab(newTab);
    Animated.parallel([
      Animated.timing(tabFadeAnim, { toValue: 1, duration: 180, useNativeDriver: false }),
      Animated.timing(tabTranslateY, { toValue: 0, duration: 180, useNativeDriver: false }),
    ]).start();
  };

  const openSubViewSmoothly = (viewName) => {
    subViewFadeAnim.setValue(1);
    subViewSlideAnim.setValue(0);
    setActiveSubView(viewName);
  };

  const closeSubViewSmoothly = () => {
    setActiveSubView(null);
  };

  useEffect(() => {
    const timer = setTimeout(() => setIsAppReady(true), 900);

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.lang = 'ja';
    }

    AsyncStorage.getItem('@setting_family_id').then((savedId) => {
      if (savedId) {
        setFamilyId(savedId);
      } else {
        const newId = generateNewFamilyId();
        AsyncStorage.setItem('@setting_family_id', newId);
        setFamilyId(newId);
      }
    });

    AsyncStorage.getItem('@setting_dark_mode').then((val) => {
      if (val !== null) setIsDarkMode(JSON.parse(val));
    });
    AsyncStorage.getItem('@setting_request_enabled').then((val) => {
      if (val !== null) setIsRequestEnabled(JSON.parse(val));
    });
    AsyncStorage.getItem('@setting_cooking_mode_enabled').then((val) => {
      if (val !== null) setIsCookingModeEnabled(JSON.parse(val));
    });
    AsyncStorage.getItem('@setting_headline_enabled').then((val) => {
      if (val !== null) setIsHeadlineEnabled(JSON.parse(val));
    });
    AsyncStorage.getItem('@setting_show_default_recipes').then((val) => {
      if (val !== null) setIsShowDefaultRecipes(JSON.parse(val));
    });
    AsyncStorage.getItem('@setting_cooked_button_enabled').then((val) => {
      if (val !== null) setIsCookedButtonEnabled(JSON.parse(val));
    });
    AsyncStorage.getItem('@setting_exclude_staple_seasonings').then((val) => {
      if (val !== null) setIsExcludeStapleSeasonings(JSON.parse(val));
    });
    AsyncStorage.getItem('@setting_members').then((val) => {
      if (val !== null) {
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed) && parsed.length > 0) setMembers(parsed);
        } catch (e) {
          console.log(e);
        }
      }
    });

    AsyncStorage.getItem('@shopping_list').then((val) => {
      if (val !== null) {
        try {
          setShoppingList(JSON.parse(val));
        } catch (e) {
          console.log(e);
        }
      }
    });

    AsyncStorage.getItem('@cooking_history').then((val) => {
      if (val !== null) {
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) {
            setCookingHistory(pruneCookingHistoryOneYear(parsed));
          }
        } catch (e) {
          console.log(e);
        }
      }
    });

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!firestoreFamilyApiUrl) return;
    fetchRecipesFromCloud();
    fetchShoppingListFromCloud();
    fetchCookingHistoryFromCloud();
    const interval = setInterval(() => {
      fetchRecipesFromCloud();
      fetchShoppingListFromCloud();
      fetchCookingHistoryFromCloud();
    }, 12000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firestoreFamilyApiUrl, firestoreShoppingApiUrl, firestoreCalendarApiUrl]);

  const updateSetting = async (key, value, setter) => {
    setter(value);
    try {
      await AsyncStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    } catch (e) {
      console.error(e);
    }
  };

  const fetchCookingHistoryFromCloud = async () => {
    if (!firestoreCalendarApiUrl) return;
    try {
      const res = await fetch(firestoreCalendarApiUrl);
      if (!res.ok) return;
      const json = await res.json();
      const rawJson = json.fields?.data?.stringValue;
      if (rawJson) {
        const parsed = JSON.parse(rawJson);
        if (Array.isArray(parsed)) {
          const pruned = pruneCookingHistoryOneYear(parsed);
          setCookingHistory(pruned);
          AsyncStorage.setItem('@cooking_history', JSON.stringify(pruned));
        }
      }
    } catch (e) {
      console.log('Calendar sync error:', e.message);
    }
  };

  const saveCookingHistory = async (newHistory) => {
    const pruned = pruneCookingHistoryOneYear(newHistory);
    setCookingHistory(pruned);
    try {
      await AsyncStorage.setItem('@cooking_history', JSON.stringify(pruned));
      if (firestoreCalendarApiUrl) {
        await fetch(`${firestoreCalendarApiUrl}?updateMask.fieldPaths=data`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: { data: { stringValue: JSON.stringify(pruned) } },
          }),
        });
      }
    } catch (e) {
      console.error('Save cooking history error:', e);
    }
  };

  const fetchShoppingListFromCloud = async () => {
    if (!firestoreShoppingApiUrl) return;
    try {
      const res = await fetch(firestoreShoppingApiUrl);
      if (!res.ok) return;
      const json = await res.json();
      const rawJson = json.fields?.data?.stringValue;
      if (rawJson) {
        const parsed = JSON.parse(rawJson);
        if (Array.isArray(parsed)) {
          setShoppingList(parsed);
          AsyncStorage.setItem('@shopping_list', JSON.stringify(parsed));
        }
      }
    } catch (e) {
      console.log('Shopping sync error:', e.message);
    }
  };

  const saveShoppingList = async (newList) => {
    setShoppingList(newList);
    try {
      await AsyncStorage.setItem('@shopping_list', JSON.stringify(newList));
      if (firestoreShoppingApiUrl) {
        await fetch(`${firestoreShoppingApiUrl}?updateMask.fieldPaths=data`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: { data: { stringValue: JSON.stringify(newList) } },
          }),
        });
      }
    } catch (e) {
      console.error('Save shopping error:', e);
    }
  };

  const handleAddRecipeToShoppingList = (recipe) => {
    const extracted = extractIngredientsFromRecipeText(recipe.extractedText, isExcludeStapleSeasonings);
    if (extracted.length === 0) {
      const msg =
        recipe.isScrapedAllowed === false
          ? 'ブックマーク保護のレシピです。材料は「元レシピ」からご確認ください。'
          : isExcludeStapleSeasonings
          ? '追加する生鮮食材がありません（基本調味料は除外設定中）。'
          : 'レシピから材料が見つかりませんでした。';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('案内', msg);
      return;
    }
    const updated = [...shoppingList, ...extracted];
    saveShoppingList(updated);

    const suffix = isExcludeStapleSeasonings ? '（基本調味料を除く）' : '';
    const successMsg = `「${recipe.title}」の材料（${extracted.length}品）を追加しました${suffix}`;
    Platform.OS === 'web' ? window.alert(successMsg) : Alert.alert('追加完了', successMsg);
  };

  const handleClearAllShoppingList = () => {
    if (shoppingList.length === 0) return;
    const msg = '買い物リストをすべて消去しますか？';
    const executeClear = () => saveShoppingList([]);

    if (Platform.OS === 'web') {
      if (window.confirm(msg)) executeClear();
    } else {
      Alert.alert('全消去', msg, [
        { text: 'キャンセル', style: 'cancel' },
        { text: '全消去', style: 'destructive', onPress: executeClear },
      ]);
    }
  };

  const handleToggleShoppingItem = (id) => {
    const updated = shoppingList.map((item) =>
      item.id === id ? { ...item, checked: !item.checked } : item
    );
    saveShoppingList(updated);
  };

  const handleDeleteShoppingItem = (id) => {
    const updated = shoppingList.filter((item) => item.id !== id);
    saveShoppingList(updated);
  };

  const handleAddManualShoppingItem = () => {
    const text = manualItemInput.trim();
    if (!text) return;
    const newItem = {
      id: `item_${Date.now()}`,
      name: text,
      aisle: categorizeIngredient(text),
      checked: false,
    };
    saveShoppingList([newItem, ...shoppingList]);
    setManualItemInput('');
  };

  const handleClearBoughtItems = () => {
    const remaining = shoppingList.filter((item) => !item.checked);
    saveShoppingList(remaining);
  };

  const unboughtCount = useMemo(() => {
    return shoppingList.filter((item) => !item.checked).length;
  }, [shoppingList]);

  // =============================================================
  // 「作った！」ボタン ＆ カレンダー記録
  // =============================================================
  const handleMarkAsCookedToday = async (recipe, customDateKey = null) => {
    const normalized = normalizeRecipeRecord(recipe);
    const nowIso = new Date().toISOString();
    const targetDateKey = customDateKey || toDateKey(new Date());

    const existingSameDay = cookingHistory.find(
      (entry) => entry.dateKey === targetDateKey && entry.recipeId === normalized.id
    );

    let nextHistory;
    if (existingSameDay) {
      nextHistory = cookingHistory.map((entry) =>
        entry.id === existingSameDay.id
          ? {
              ...entry,
              cookedAt: nowIso,
              title: normalized.title,
              category: normalized.category || '主菜',
            }
          : entry
      );
    } else {
      const newEntry = {
        id: `cook_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        dateKey: targetDateKey,
        cookedAt: nowIso,
        recipeId: normalized.id,
        title: normalized.title,
        category: normalized.category || '主菜',
      };
      nextHistory = [newEntry, ...cookingHistory];
    }

    await saveCookingHistory(nextHistory);

    const updated = {
      ...normalized,
      lastCookedAt: nowIso,
      isCooked: true,
      isRequested: false,
    };

    if (selectedRecipe && selectedRecipe.id === normalized.id) {
      setSelectedRecipe(updated);
    }
    setCompletedRecipe(updated);
    setSelectedCalendarDateKey(targetDateKey);
    setIsCookingCompleteModalVisible(true);

    setCloudRecipes((prev) => {
      const exists = prev.some((r) => r.id === normalized.id);
      if (exists) {
        return prev.map((r) => (r.id === normalized.id ? updated : r));
      }
      return [...prev, updated];
    });

    if (firestoreFamilyApiUrl) {
      try {
        const updateUrl = `${firestoreFamilyApiUrl}/${normalized.id}?updateMask.fieldPaths=data`;
        await fetch(updateUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: { data: { stringValue: JSON.stringify(updated) } },
          }),
        });
      } catch (e) {
        console.log(e);
      }
    }
  };

  // =============================================================
  // カレンダーから作ったメニューを消す（誤登録の削除）
  // =============================================================
  const handleDeleteCalendarEntry = (entry) => {
    if (!entry) return;
    const confirmMsg = `${formatDateKeyJapanese(entry.dateKey)}の「${entry.title}」の記録を取り消しますか？`;

    const executeRemove = async () => {
      const remainingHistory = cookingHistory.filter((item) => item.id !== entry.id);
      await saveCookingHistory(remainingHistory);

      const targetRecipe = allRecipes.find((r) => r.id === entry.recipeId);
      if (targetRecipe) {
        const recipeEntries = remainingHistory.filter((item) => item.recipeId === entry.recipeId);
        const latestEntry = recipeEntries.length > 0 ? recipeEntries[0] : null;
        const updatedRecipe = {
          ...targetRecipe,
          lastCookedAt: latestEntry ? latestEntry.cookedAt || `${latestEntry.dateKey}T12:00:00.000Z` : null,
          isCooked: recipeEntries.length > 0 ? true : !!targetRecipe.isDefault,
        };

        if (selectedRecipe && selectedRecipe.id === targetRecipe.id) {
          setSelectedRecipe(updatedRecipe);
        }
        setCloudRecipes((prev) =>
          prev.map((r) => (r.id === targetRecipe.id ? updatedRecipe : r))
        );

        if (firestoreFamilyApiUrl) {
          try {
            const updateUrl = `${firestoreFamilyApiUrl}/${targetRecipe.id}?updateMask.fieldPaths=data`;
            await fetch(updateUrl, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fields: { data: { stringValue: JSON.stringify(updatedRecipe) } },
              }),
            });
          } catch (e) {
            console.log(e);
          }
        }
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(confirmMsg)) {
        executeRemove();
      }
    } else {
      Alert.alert('記録の取り消し', confirmMsg, [
        { text: 'キャンセル', style: 'cancel' },
        { text: '消す', style: 'destructive', onPress: executeRemove },
      ]);
    }
  };

  const handleQuickRateInCompleteModal = async (memberId, starVal) => {
    if (!completedRecipe || !firestoreFamilyApiUrl) return;
    const nextRatings = {
      ...(completedRecipe.familyRatings || {}),
      [memberId]: starVal,
    };
    const updated = {
      ...completedRecipe,
      familyRatings: nextRatings,
      isCooked: true,
    };
    setCompletedRecipe(updated);
    if (selectedRecipe && selectedRecipe.id === updated.id) {
      setSelectedRecipe(updated);
    }
    setCloudRecipes((prev) => {
      const exists = prev.some((r) => r.id === updated.id);
      if (exists) {
        return prev.map((r) => (r.id === updated.id ? updated : r));
      }
      return [...prev, updated];
    });

    try {
      const updateUrl = `${firestoreFamilyApiUrl}/${updated.id}?updateMask.fieldPaths=data`;
      await fetch(updateUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: { data: { stringValue: JSON.stringify(updated) } },
        }),
      });
    } catch (e) {
      console.log(e);
    }
  };

  const handleJoinFamily = async () => {
    let input = joinFamilyInput.trim();
    input = input.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) =>
      String.fromCharCode(s.charCodeAt(0) - 0xfee0)
    );
    input = input.toUpperCase().replace(/\s+/g, '');

    if (input && !input.startsWith('FAM-')) input = 'FAM-' + input;

    if (!input || input === 'FAM-') {
      const msg = '家族IDを入力してください';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('入力エラー', msg);
      return;
    }
    if (input === familyId) {
      const msg = '既にこの家族グループに参加しています';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('案内', msg);
      return;
    }

    const confirmMsg = `家族ID「${input}」に参加しますか？`;
    const doJoin = async () => {
      await AsyncStorage.setItem('@setting_family_id', input);
      setFamilyId(input);
      setJoinFamilyInput('');
      setCloudRecipes([]);
      switchTabSmoothly('recipes');
      const sMsg = `家族グループ「${input}」に参加しました`;
      Platform.OS === 'web' ? window.alert(sMsg) : Alert.alert('完了', sMsg);
    };

    if (Platform.OS === 'web') {
      if (window.confirm(confirmMsg)) doJoin();
    } else {
      Alert.alert('家族共有の切り替え', confirmMsg, [
        { text: 'キャンセル', style: 'cancel' },
        { text: '参加する', onPress: doJoin },
      ]);
    }
  };

  const handleRegenerateFamilyId = () => {
    const confirmMsg = '新しい家族IDを再発行しますか？';
    const doRegen = async () => {
      const newId = generateNewFamilyId();
      await AsyncStorage.setItem('@setting_family_id', newId);
      setFamilyId(newId);
      setCloudRecipes([]);
      const msg = `新しい家族ID: ${newId} を発行しました`;
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('完了', msg);
    };

    if (Platform.OS === 'web') {
      if (window.confirm(confirmMsg)) doRegen();
    } else {
      Alert.alert('家族IDの再発行', confirmMsg, [
        { text: 'キャンセル', style: 'cancel' },
        { text: '再発行', onPress: doRegen },
      ]);
    }
  };

  const saveMembers = async (newMembers) => {
    setMembers(newMembers);
    try {
      await AsyncStorage.setItem('@setting_members', JSON.stringify(newMembers));
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddMember = () => {
    if (members.length >= 5) {
      const msg = 'メンバーは最大5人まで追加できます';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('上限', msg);
      return;
    }
    const newMember = {
      id: `m_${Date.now()}`,
      name: `家族${members.length + 1}`,
    };
    saveMembers([...members, newMember]);
  };

  const handleUpdateMemberName = (id, newName) => {
    const updated = members.map((m) => (m.id === id ? { ...m, name: newName } : m));
    saveMembers(updated);
  };

  const handleDeleteMember = (id) => {
    if (members.length <= 1) {
      const msg = '最低1人のメンバーが必要です';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('注意', msg);
      return;
    }
    const confirmMsg = 'このメンバーを削除しますか？';
    const doDelete = () => saveMembers(members.filter((m) => m.id !== id));

    if (Platform.OS === 'web') {
      if (window.confirm(confirmMsg)) doDelete();
    } else {
      Alert.alert('確認', confirmMsg, [
        { text: 'キャンセル', style: 'cancel' },
        { text: '削除', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const fetchRecipesFromCloud = async () => {
    if (!firestoreFamilyApiUrl) return;
    try {
      const res = await fetch(firestoreFamilyApiUrl);
      if (!res.ok) return;
      const json = await res.json();
      if (!json.documents) {
        setCloudRecipes([]);
        return;
      }

      const list = json.documents.map((doc) => {
        const id = doc.name.split('/').pop();
        const rawJson = doc.fields?.data?.stringValue;
        if (rawJson) {
          try {
            const parsed = JSON.parse(rawJson);
            return normalizeRecipeRecord({ id, ...parsed });
          } catch (e) {
            return normalizeRecipeRecord({ id, title: 'データ取得エラー' });
          }
        }
        return normalizeRecipeRecord({ id });
      });

      setCloudRecipes(list);
    } catch (e) {
      console.log('Cloud sync error:', e.message);
    }
  };

  const handlePullToRefresh = async () => {
    setIsRefreshing(true);
    await fetchRecipesFromCloud();
    await fetchShoppingListFromCloud();
    await fetchCookingHistoryFromCloud();
    setIsRefreshing(false);
  };

  const handleToggleRequest = async (recipe) => {
    if (!firestoreFamilyApiUrl) return;
    const nextRequested = !recipe.isRequested;
    const updatedRecipe = normalizeRecipeRecord({ ...recipe, isRequested: nextRequested });

    setSelectedRecipe(updatedRecipe);
    setCloudRecipes((prev) => {
      const exists = prev.some((r) => r.id === recipe.id);
      if (exists) {
        return prev.map((r) => (r.id === recipe.id ? updatedRecipe : r));
      }
      return [...prev, updatedRecipe];
    });

    try {
      const updateUrl = `${firestoreFamilyApiUrl}/${recipe.id}?updateMask.fieldPaths=data`;
      await fetch(updateUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: { data: { stringValue: JSON.stringify(updatedRecipe) } },
        }),
      });
    } catch (e) {
      const msg = 'リクエストの更新に失敗しました';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('エラー', msg);
    }
  };

  const toggleCookingMode = () => {
    if (isCookingMode && selectedRecipe) {
      handleMarkAsCookedToday(selectedRecipe);
    }
    if (!isCookingMode) {
      setCheckedSteps({});
      setCheckedIngredients({});
    }
    setIsCookingMode((prev) => !prev);
  };

  const toggleStepCheck = (index) => {
    setCheckedSteps((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const toggleIngredientCheck = (index) => {
    setCheckedIngredients((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  // =============================================================
  // カレンダー用の集計データ（直近1年分保管）
  // =============================================================
  const mergedCookingHistory = useMemo(() => {
    const combined = [...cookingHistory];
    const existingKeys = new Set(combined.map((e) => `${e.dateKey}_${e.recipeId}`));

    allRecipes.forEach((r) => {
      if (r.lastCookedAt) {
        const dKey = toDateKey(r.lastCookedAt);
        const key = `${dKey}_${r.id}`;
        if (!existingKeys.has(key)) {
          combined.push({
            id: `legacy_${r.id}_${dKey}`,
            dateKey: dKey,
            cookedAt: r.lastCookedAt,
            recipeId: r.id,
            title: r.title,
            category: r.category || '主菜',
          });
          existingKeys.add(key);
        }
      }
    });

    return pruneCookingHistoryOneYear(combined);
  }, [cookingHistory, allRecipes]);

  const historyByDateMap = useMemo(() => {
    const map = {};
    mergedCookingHistory.forEach((entry) => {
      if (!map[entry.dateKey]) {
        map[entry.dateKey] = [];
      }
      map[entry.dateKey].push(entry);
    });
    return map;
  }, [mergedCookingHistory]);

  const cookedTodayRecipeIdSet = useMemo(() => {
    const todayEntries = historyByDateMap[todayDateKey] || [];
    return new Set(todayEntries.map((e) => e.recipeId));
  }, [historyByDateMap, todayDateKey]);

  const calendarWeeks = useMemo(() => {
    return generateCalendarMonthWeeks(calendarYear, calendarMonth);
  }, [calendarYear, calendarMonth]);

  const currentMonthStats = useMemo(() => {
    const monthPrefix = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-`;
    const monthEntries = mergedCookingHistory.filter((e) => e.dateKey.startsWith(monthPrefix));
    const uniqueDays = new Set(monthEntries.map((e) => e.dateKey));
    return {
      totalDishes: monthEntries.length,
      cookedDays: uniqueDays.size,
    };
  }, [mergedCookingHistory, calendarYear, calendarMonth]);

  const selectedDateEntries = useMemo(() => {
    return historyByDateMap[selectedCalendarDateKey] || [];
  }, [historyByDateMap, selectedCalendarDateKey]);

  const canGoPrevMonth = useMemo(() => {
    const minDate = new Date(now.getFullYear(), now.getMonth() - 12, 1);
    const target = new Date(calendarYear, calendarMonth - 1, 1);
    return target >= minDate;
  }, [calendarYear, calendarMonth, now]);

  const canGoNextMonth = useMemo(() => {
    const maxDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const target = new Date(calendarYear, calendarMonth + 1, 1);
    return target <= maxDate;
  }, [calendarYear, calendarMonth, now]);

  const handleChangeCalendarMonth = (delta) => {
    const nextDate = new Date(calendarYear, calendarMonth + delta, 1);
    const nextY = nextDate.getFullYear();
    const nextM = nextDate.getMonth();
    setCalendarYear(nextY);
    setCalendarMonth(nextM);

    if (nextY === now.getFullYear() && nextM === now.getMonth()) {
      setSelectedCalendarDateKey(todayDateKey);
    } else {
      const mStr = String(nextM + 1).padStart(2, '0');
      setSelectedCalendarDateKey(`${nextY}-${mStr}-01`);
    }
  };

  const handleJumpToCurrentMonth = () => {
    setCalendarYear(now.getFullYear());
    setCalendarMonth(now.getMonth());
    setSelectedCalendarDateKey(todayDateKey);
  };

  const requestedCount = useMemo(() => {
    return allRecipes.filter((r) => r.isRequested).length;
  }, [allRecipes]);

  const wantToCookCount = useMemo(() => {
    return allRecipes.filter((r) => !r.isCooked).length;
  }, [allRecipes]);

  const userRecipeCount = useMemo(() => {
    return allRecipes.filter((r) => !r.isDefault).length;
  }, [allRecipes]);

  const recentCookedRecipes = useMemo(() => {
    return allRecipes
      .filter((r) => r.lastCookedAt)
      .sort((a, b) => new Date(b.lastCookedAt) - new Date(a.lastCookedAt))
      .slice(0, 3);
  }, [allRecipes]);

  const topStarredRecipes = useMemo(() => {
    return allRecipes.filter((r) => {
      if (!r.familyRatings) return false;
      return Object.values(r.familyRatings).some((v) => v === 3);
    });
  }, [allRecipes]);

  const wantToCookRecipes = useMemo(() => {
    return allRecipes.filter((r) => !r.isCooked);
  }, [allRecipes]);

  // ホームの主役：おすすめ料理（★★★があればごぶさた順、なければ調理済み・基本レシピから1品提案）
  const recommendedStapleRecipe = useMemo(() => {
    const pool = topStarredRecipes.length > 0 ? topStarredRecipes : allRecipes;
    if (pool.length === 0) return null;
    const sorted = [...pool].sort((a, b) => {
      const tA = a.lastCookedAt ? new Date(a.lastCookedAt).getTime() : 0;
      const tB = b.lastCookedAt ? new Date(b.lastCookedAt).getTime() : 0;
      return tA - tB;
    });
    return sorted[0] || null;
  }, [topStarredRecipes, allRecipes]);

  const filteredRecipes = useMemo(() => {
    let result = [...allRecipes];

    if (isRequestEnabled && filterMode === 'requested') {
      result = result.filter((r) => r.isRequested);
    } else if (filterMode === 'wantToCook') {
      result = result.filter((r) => !r.isCooked);
    } else if (filterMode === 'userOnly') {
      result = result.filter((r) => !r.isDefault);
    } else if (filterMode === 'bento') {
      result = result.filter((r) => r.isBento);
    } else if (filterMode === 'mealPrep') {
      result = result.filter((r) => r.isMealPrep);
    } else if (filterMode === 'preset') {
      result = result.filter((r) => r.isDefault);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.title?.toLowerCase().includes(query) ||
          r.category?.toLowerCase().includes(query) ||
          r.notes?.toLowerCase().includes(query) ||
          r.extractedText?.toLowerCase().includes(query) ||
          r.sourceUrl?.toLowerCase().includes(query) ||
          r.creatorName?.toLowerCase().includes(query) ||
          r.ogpTitle?.toLowerCase().includes(query)
      );
    }

    if (isRequestEnabled) {
      result.sort((a, b) => {
        const aReq = a.isRequested ? 1 : 0;
        const bReq = b.isRequested ? 1 : 0;
        return bReq - aReq;
      });
    }

    return result;
  }, [allRecipes, searchQuery, filterMode, isRequestEnabled]);

  const handleProcessUrlImport = async () => {
    const targetUrl = importUrlText.trim();
    if (!targetUrl) {
      const msg = 'レシピページやSNS投稿のURLを入力してください';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('入力エラー', msg);
      return;
    }

    const detectedPlatform = detectSourcePlatform(targetUrl);
    const defaultCreator = inferCreatorNameFromUrl(targetUrl);

    setIsUrlModalVisible(false);
    resetForm();
    setSourceUrl(targetUrl);
    setSourcePlatform(detectedPlatform);
    setCreatorName(defaultCreator || '');
    openSubViewSmoothly('edit');

    setIsLoading(true);
    setLoadingMessage('出典情報とレシピの要点インデックスを抽出中...');

    try {
      const response = await fetch(AI_PROXY_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-App-Token': APP_SECRET_TOKEN,
        },
        body: JSON.stringify({
          webUrl: targetUrl,
          sourceUrl: targetUrl,
          sourcePlatform: detectedPlatform,
          systemPrompt: RECIPE_EXTRACTION_SYSTEM_PROMPT,
        }),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error?.message || json.error || 'Webページの読み込みに失敗しました');
      }

      const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const parsedResult = parseAiExtractionResponse(rawText, targetUrl, json.meta);

      if (parsedResult) {
        setTitle(parsedResult.title);
        setCreatorName(parsedResult.creatorName || defaultCreator || '');
        setOgpTitle(parsedResult.ogpTitle || '');
        setSourceUrl(targetUrl);
        setSourcePlatform(parsedResult.sourcePlatform || detectedPlatform);
        setIsScrapedAllowed(parsedResult.isScrapedAllowed);
        setExtractedText(parsedResult.extractedText);
        if (parsedResult.cookingTime) setCookingTime(parsedResult.cookingTime);
        if (parsedResult.category) setCategory(parsedResult.category);
        setFoodImageUri(null);
      } else {
        throw new Error('レシピ情報を読み取れませんでした');
      }
    } catch (e) {
      setIsScrapedAllowed(false);
      setTitle(defaultCreator ? `${defaultCreator}さんのレシピ` : 'ブックマークしたレシピ');
      setExtractedText('');
      const friendlyMsg = `本文抽出が制限されているため「ブックマークモード」に切り替えました。料理名を確認してそのまま保存できます。`;
      Platform.OS === 'web' ? window.alert(friendlyMsg) : Alert.alert('ブックマークモード', friendlyMsg);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
      setImportUrlText('');
    }
  };

  const handleExportJsonBackup = () => {
    if (allRecipes.length === 0) {
      const msg = '書き出すレシピがありません';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('案内', msg);
      return;
    }

    const backupPayload = {
      exportedAt: new Date().toISOString(),
      recipes: allRecipes,
      cookingHistory: mergedCookingHistory,
    };
    const dataStr = JSON.stringify(backupPayload, null, 2);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `meppy_recipes_${dateStr}.json`;

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const blob = new Blob([dataStr], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      window.alert(`全${allRecipes.length}品のバックアップ(.json)を保存しました`);
    } else {
      Share.share({
        title: filename,
        message: dataStr,
      });
    }
  };

  const handleCopyTextBackup = async () => {
    if (allRecipes.length === 0) return;

    let textSummary = '【わが家のレシピ帳 Meppy】\n\n';
    allRecipes.forEach((r, idx) => {
      textSummary += `${idx + 1}. ${r.title} (${r.category || 'その他'})\n`;
      if (r.creatorName) textSummary += `   考案者: ${r.creatorName} さん\n`;
      if (r.notes) textSummary += `   メモ: ${r.notes}\n`;
      if (r.sourceUrl) textSummary += `   URL: ${r.sourceUrl}\n`;
      textSummary += `\n`;
    });

    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(textSummary);
      window.alert('レシピ一覧テキストをコピーしました');
    } else {
      Share.share({
        title: 'わが家のレシピ一覧',
        message: textSummary,
      });
    }
  };

  const pickRecipeImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.35,
        base64: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const processed = await processAssetForUpload(result.assets[0]);
      if (!processed || !processed.base64) {
        const msg = '画像の読み込みに失敗しました';
        Platform.OS === 'web' ? window.alert(msg) : Alert.alert('画像エラー', msg);
        return;
      }

      resetForm();
      openSubViewSmoothly('edit');

      setIsLoading(true);
      setLoadingMessage('材料と手順インデックスを抽出中...');
      await processImageWithGemini(processed.base64, processed.mimeType);
    } catch (error) {
      const msg = error.message;
      Platform.OS === 'web' ? window.alert(`選択エラー: ${msg}`) : Alert.alert('選択エラー', msg);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const pickFoodPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.35,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const processed = await processAssetForUpload(result.assets[0]);
        if (processed) {
          setFoodImageUri(processed.dataUri);
        }
      }
    } catch (error) {
      const msg = error.message;
      Platform.OS === 'web' ? window.alert(`写真選択エラー: ${msg}`) : Alert.alert('写真選択エラー', msg);
    }
  };

  const processImageWithGemini = async (base64Data, mimeType) => {
    try {
      const response = await fetch(AI_PROXY_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-App-Token': APP_SECRET_TOKEN,
        },
        body: JSON.stringify({
          base64Data,
          mimeType,
          systemPrompt: RECIPE_EXTRACTION_SYSTEM_PROMPT,
        }),
      });

      const json = await response.json();
      if (!response.ok) {
        const msg = json.error?.message || json.error || '通信に失敗しました';
        Platform.OS === 'web' ? window.alert(`解析エラー: ${msg}`) : Alert.alert('解析エラー', msg);
        return;
      }

      const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsedResult = parseAiExtractionResponse(rawText, sourceUrl, json.meta);
      if (parsedResult) {
        setTitle(parsedResult.title);
        if (parsedResult.creatorName) setCreatorName(parsedResult.creatorName);
        if (parsedResult.ogpTitle) setOgpTitle(parsedResult.ogpTitle);
        setIsScrapedAllowed(parsedResult.isScrapedAllowed);
        setExtractedText(parsedResult.extractedText);
      } else {
        const msg = '文字を認識できませんでした。手動で入力してください。';
        Platform.OS === 'web' ? window.alert(msg) : Alert.alert('解析失敗', msg);
      }
    } catch (e) {
      const msg = e.message;
      Platform.OS === 'web' ? window.alert(`通信エラー: ${msg}`) : Alert.alert('通信エラー', msg);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      const msg = '料理名を入力してください';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('入力エラー', msg);
      return;
    }
    if (!firestoreFamilyApiUrl) {
      const msg = '家族IDが取得できていません';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('エラー', msg);
      return;
    }

    const hasAnyRating = Object.values(familyRatings).some((v) => v > 0);
    const finalCookedState = isCookedState || hasAnyRating;

    const cleanFoodImageUri = await compressImageForFirestore(foodImageUri);
    const trimmedSourceUrl = sourceUrl.trim();
    const resolvedPlatform = detectSourcePlatform(trimmedSourceUrl);
    const resolvedCreator =
      creatorName && creatorName.trim()
        ? creatorName.trim()
        : inferCreatorNameFromUrl(trimmedSourceUrl);

    const payload = {
      title: title.trim(),
      category: category || 'その他',
      familyRatings: familyRatings || {},
      extractedText: isScrapedAllowed ? extractedText : '',
      notes,
      cookingTime: Number(cookingTime) || 15,
      isBento: !!isBento,
      isMealPrep: !!isMealPrep,
      imageUri: null,
      foodImageUri: cleanFoodImageUri || null,
      sourceUrl: trimmedSourceUrl,
      webUrl: trimmedSourceUrl,
      sourcePlatform: resolvedPlatform,
      creatorName: resolvedCreator || null,
      ogpTitle: ogpTitle && ogpTitle.trim() ? ogpTitle.trim() : null,
      isScrapedAllowed: !!isScrapedAllowed,
      updatedAt: new Date().toLocaleDateString('ja-JP'),
      lastCookedAt: editingRecipeId ? selectedRecipe?.lastCookedAt || null : null,
      isRequested: editingRecipeId ? (selectedRecipe?.isRequested || false) : false,
      isDefault: isEditingDefault,
      isCooked: finalCookedState,
    };

    try {
      let res;
      if (editingRecipeId) {
        const updateUrl = `${firestoreFamilyApiUrl}/${editingRecipeId}?updateMask.fieldPaths=data`;
        res = await fetch(updateUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: { data: { stringValue: JSON.stringify(payload) } },
          }),
        });
      } else {
        payload.createdAt = new Date().toLocaleDateString('ja-JP');
        res = await fetch(firestoreFamilyApiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: { data: { stringValue: JSON.stringify(payload) } },
          }),
        });
      }

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error?.message || `通信エラー (${res.status})`);
      }

      await fetchRecipesFromCloud();
      if (editingRecipeId && selectedRecipe && selectedRecipe.id === editingRecipeId) {
        setSelectedRecipe(normalizeRecipeRecord({ id: editingRecipeId, ...payload }));
      }
      resetForm();
      closeSubViewSmoothly();
    } catch (e) {
      const msg = e.message;
      Platform.OS === 'web' ? window.alert(`保存エラー: ${msg}`) : Alert.alert('保存エラー', msg);
    }
  };

  const handleEditPress = (rawRecipe) => {
    const recipe = normalizeRecipeRecord(rawRecipe);
    setEditingRecipeId(recipe.id);
    setIsEditingDefault(!!recipe.isDefault);
    setIsCookedState(!!recipe.isCooked);
    setTitle(recipe.title || '');
    setCategory(recipe.category || '主菜');
    setFamilyRatings(recipe.familyRatings || {});
    setExtractedText(recipe.extractedText || '');
    setNotes(recipe.notes || '');
    setCookingTime(recipe.cookingTime || 15);
    setIsBento(!!recipe.isBento);
    setIsMealPrep(!!recipe.isMealPrep);
    setFoodImageUri(recipe.foodImageUri || null);
    setSourceUrl(recipe.sourceUrl || '');
    setSourcePlatform(recipe.sourcePlatform || detectSourcePlatform(recipe.sourceUrl));
    setCreatorName(recipe.creatorName || '');
    setOgpTitle(recipe.ogpTitle || '');
    setIsScrapedAllowed(recipe.isScrapedAllowed !== false);
    openSubViewSmoothly('edit');
  };

  const handleResetDefaultRecipe = (recipeId) => {
    if (!firestoreFamilyApiUrl) return;

    const executeReset = async () => {
      try {
        await fetch(`${firestoreFamilyApiUrl}/${recipeId}`, { method: 'DELETE' });
        await fetchRecipesFromCloud();
        resetForm();
        setSelectedRecipe(null);
        closeSubViewSmoothly();
        const msg = '基本レシピを初期状態に戻しました';
        Platform.OS === 'web' ? window.alert(msg) : Alert.alert('完了', msg);
      } catch (e) {
        const msg = e.message;
        Platform.OS === 'web' ? window.alert(msg) : Alert.alert('エラー', msg);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('このレシピを初期状態に戻しますか？')) {
        executeReset();
      }
    } else {
      Alert.alert('基本レシピのリセット', 'このレシピを初期状態に戻しますか？', [
        { text: 'キャンセル', style: 'cancel' },
        { text: 'リセット', onPress: executeReset },
      ]);
    }
  };

  const handleDeletePress = (recipeId) => {
    if (!firestoreFamilyApiUrl) return;

    const executeDelete = async () => {
      try {
        const res = await fetch(`${firestoreFamilyApiUrl}/${recipeId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('削除リクエストに失敗しました');
        await fetchRecipesFromCloud();
        resetForm();
        setSelectedRecipe(null);
        closeSubViewSmoothly();
      } catch (e) {
        const msg = e.message;
        Platform.OS === 'web' ? window.alert(`削除エラー: ${msg}`) : Alert.alert('削除エラー', msg);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('このレシピを削除しますか？')) {
        executeDelete();
      }
    } else {
      Alert.alert('レシピの削除', 'このレシピを削除しますか？', [
        { text: 'キャンセル', style: 'cancel' },
        { text: '削除', style: 'destructive', onPress: executeDelete },
      ]);
    }
  };

  const handleOpenWebPage = async (url) => {
    await openCreatorUrlInAppBrowser(url, theme.primary);
  };

  const resetForm = () => {
    setEditingRecipeId(null);
    setIsEditingDefault(false);
    setIsCookedState(false);
    setCategory('主菜');
    setCookingTime(15);
    setIsBento(false);
    setIsMealPrep(false);
    const defaultRatings = {};
    members.forEach((m) => {
      defaultRatings[m.id] = 0;
    });
    setFamilyRatings(defaultRatings);
    setTitle('');
    setExtractedText('');
    setNotes('');
    setFoodImageUri(null);
    setSourceUrl('');
    setSourcePlatform('manual');
    setCreatorName('');
    setOgpTitle('');
    setIsScrapedAllowed(true);
  };

  const getCategoryIcon = (catKey) => {
    const found = CATEGORIES.find((c) => c.key === catKey);
    return found ? found.icon : '🍽️';
  };

  if (!isAppReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FAF6F0', justifyContent: 'center', alignItems: 'center' }}>
        <StatusBar barStyle="dark-content" backgroundColor="#FAF6F0" />
        <Image
          source={require('./assets/logo.png')}
          style={{ width: 160, height: 52, marginBottom: 10 }}
          resizeMode="contain"
        />
        <Text style={{ fontSize: 12.5, color: '#4E3629', fontWeight: '600', letterSpacing: 1.5 }}>
          わが家のレシピ帳
        </Text>
      </View>
    );
  }

  // =============================================================
  // サブ画面：レシピ詳細画面（上部を軽くし、料理名・時間・人数・材料をすぐ表示）
  // =============================================================
  if (activeSubView === 'detail' && selectedRecipe) {
    const normalizedRecipe = normalizeRecipeRecord(selectedRecipe);
    const mainImage = normalizedRecipe.foodImageUri;
    const isCookedToday = cookedTodayRecipeIdSet.has(normalizedRecipe.id);

    const scaleFactor = servingSize / 2;
    const { ingredients: parsedIngredients, steps: parsedSteps } = parseStructuredRecipeSections(
      normalizedRecipe.extractedText,
      normalizedRecipe.title,
      scaleFactor
    );

    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle={theme.statusBar} backgroundColor={theme.headerBg} />

        <Animated.View
          style={{
            flex: 1,
            opacity: subViewFadeAnim,
            transform: [{ translateY: subViewSlideAnim }],
          }}
        >
          <View style={styles.header}>
            <View style={styles.headerSideArea}>
              <TouchableOpacity
                onPress={closeSubViewSmoothly}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}
              >
                <Ionicons name="chevron-back-outline" size={18} color={theme.textSub} />
                <Text style={styles.headerButton}>戻る</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.headerTitle}>レシピ詳細</Text>

            <View style={[styles.headerSideArea, { alignItems: 'flex-end' }]}>
              <TouchableOpacity
                onPress={() => handleEditPress(normalizedRecipe)}
                style={{ paddingVertical: 6, paddingHorizontal: 8 }}
                activeOpacity={0.7}
              >
                <Text style={styles.editButtonText}>編集</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 60 }}>
            {mainImage ? (
              <Image source={{ uri: mainImage }} style={styles.detailImage} resizeMode="cover" />
            ) : null}

            {/* 1. 料理名・時間・カテゴリを最上部にコンパクト表示 */}
            <View style={styles.detailHeaderBlock}>
              <View style={styles.detailTitleRow}>
                <Text style={styles.detailTitle}>{normalizedRecipe.title}</Text>
              </View>

              <View style={styles.detailMetaRow}>
                {normalizedRecipe.cookingTime ? (
                  <View style={styles.detailMetaPill}>
                    <Ionicons name="time-outline" size={13} color={theme.textSub} style={{ marginRight: 3 }} />
                    <Text style={styles.detailMetaPillText}>約{normalizedRecipe.cookingTime}分</Text>
                  </View>
                ) : null}
                {normalizedRecipe.category ? (
                  <View style={styles.detailMetaPill}>
                    <Text style={styles.detailMetaPillText}>{normalizedRecipe.category}</Text>
                  </View>
                ) : null}
                {normalizedRecipe.isBento ? (
                  <View style={styles.detailMetaPill}>
                    <Text style={styles.detailMetaPillText}>お弁当</Text>
                  </View>
                ) : null}
                {normalizedRecipe.isMealPrep ? (
                  <View style={styles.detailMetaPill}>
                    <Text style={styles.detailMetaPillText}>作り置き</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* 2. コンパクト化した出典クレジットカード（1行スリムバー） */}
            <CreatorCreditCard
              sourceUrl={normalizedRecipe.sourceUrl}
              sourcePlatform={normalizedRecipe.sourcePlatform}
              creatorName={normalizedRecipe.creatorName}
              ogpTitle={normalizedRecipe.ogpTitle}
              isScrapedAllowed={normalizedRecipe.isScrapedAllowed}
              styles={styles}
              theme={theme}
              onOpenUrl={handleOpenWebPage}
            />

            {/* 3. YouTube / Instagram 公式プレイヤー（初期状態は折りたたみで材料を早く見せる） */}
            {(normalizedRecipe.sourcePlatform === 'youtube' ||
              normalizedRecipe.sourcePlatform === 'instagram') && (
              <OfficialSocialEmbed
                sourceUrl={normalizedRecipe.sourceUrl}
                sourcePlatform={normalizedRecipe.sourcePlatform}
                creatorName={normalizedRecipe.creatorName}
                styles={styles}
                theme={theme}
                onOpenUrl={handleOpenWebPage}
              />
            )}

            {/* 4. 主要操作（調理スタートのみオレンジ塗りつぶし）＋補助操作（白背景＋薄い枠線） */}
            {isCookingModeEnabled ? (
              <TouchableOpacity
                style={[styles.bigCookStartBtn, isCookingMode && styles.bigCookStartBtnActive]}
                onPress={toggleCookingMode}
                activeOpacity={0.85}
              >
                <Ionicons
                  name={isCookingMode ? 'checkmark-done-outline' : 'flame-outline'}
                  size={17}
                  color="#FFFFFF"
                />
                <Text style={styles.bigCookStartBtnText}>
                  {isCookingMode ? '調理を終了して記録する' : '調理スタート（画面スリープ防止）'}
                </Text>
              </TouchableOpacity>
            ) : null}

            <View style={styles.smartActionBar}>
              <TouchableOpacity
                style={[
                  styles.smartActionBtn,
                  isCookedToday ? styles.smartActionBtnCookedDone : styles.smartActionBtnCooked,
                ]}
                onPress={() => handleMarkAsCookedToday(normalizedRecipe)}
                activeOpacity={0.75}
              >
                <Ionicons
                  name={isCookedToday ? 'checkmark-circle' : 'checkmark-circle-outline'}
                  size={15}
                  color={isCookedToday ? theme.accentSage : theme.textSub}
                />
                <Text
                  style={[
                    styles.smartActionBtnTextCooked,
                    isCookedToday && { color: theme.accentSage, fontWeight: '700' },
                  ]}
                >
                  {isCookedToday ? '今日作った' : '作った！'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.smartActionBtn}
                onPress={() => handleAddRecipeToShoppingList(normalizedRecipe)}
                activeOpacity={0.75}
              >
                <Ionicons name="cart-outline" size={15} color={theme.textSub} />
                <Text style={styles.smartActionBtnText}>買い物追加</Text>
              </TouchableOpacity>

              {isRequestEnabled ? (
                <TouchableOpacity
                  style={[styles.smartActionBtn, normalizedRecipe.isRequested && styles.smartActionBtnActiveRequest]}
                  onPress={() => handleToggleRequest(normalizedRecipe)}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name={normalizedRecipe.isRequested ? 'heart' : 'heart-outline'}
                    size={15}
                    color={normalizedRecipe.isRequested ? theme.primary : theme.textSub}
                  />
                  <Text style={[styles.smartActionBtnText, normalizedRecipe.isRequested && styles.smartActionBtnTextActive]}>
                    {normalizedRecipe.isRequested ? 'リクエスト中' : '食べたい'}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* 5. 材料セクション（「食材名／分量」で左右を揃え、分量切り替えをヘッダー内に統合） */}
            {normalizedRecipe.isScrapedAllowed === false ? (
              <View style={styles.detailSection}>
                <Text style={styles.sectionHeader}>ブックマーク保護</Text>
                <View style={styles.bookmarkProtectedBox}>
                  <Text style={styles.bookmarkProtectedTitle}>
                    ブックマークモードで登録されています
                  </Text>
                  <Text style={styles.bookmarkProtectedDesc}>
                    配信元の著作権・ポリシー（robots.txt / noarchive等）を尊重し、本文は保存していません。上の「元レシピ」からご確認ください。
                  </Text>
                </View>
              </View>
            ) : (
              <>
                <View style={styles.detailSection}>
                  <View style={styles.detailSectionHeaderRow}>
                    <Text style={styles.sectionHeader}>材料</Text>
                    <View style={styles.servingInlineRow}>
                      <Text style={styles.servingLabel}>分量</Text>
                      <View style={styles.servingChips}>
                        {Array.of(1, 2, 3, 4).map((size) => (
                          <TouchableOpacity
                            key={size}
                            style={[styles.servingChip, servingSize === size && styles.servingChipActive]}
                            onPress={() => setServingSize(size)}
                          >
                            <Text style={[styles.servingChipText, servingSize === size && styles.servingChipTextActive]}>
                              {size}人
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>

                  {parsedIngredients.length > 0 ? (
                    parsedIngredients.map((ing, idx) => {
                      const isChecked = !!checkedIngredients[idx];
                      return (
                        <TouchableOpacity
                          key={`ing_${idx}`}
                          activeOpacity={isCookingMode ? 0.7 : 1}
                          onPress={() => isCookingMode && toggleIngredientCheck(idx)}
                          style={[
                            styles.ingredientRow,
                            idx === parsedIngredients.length - 1 && { borderBottomWidth: 0 },
                          ]}
                        >
                          {isCookingMode ? (
                            <Ionicons
                              name={isChecked ? 'checkbox' : 'square-outline'}
                              size={17}
                              color={isChecked ? theme.accentSage : theme.textMuted}
                              style={{ marginRight: 8 }}
                            />
                          ) : null}
                          <Text
                            style={[
                              styles.ingredientNameText,
                              isCookingMode && isChecked && styles.checkedLineText,
                            ]}
                          >
                            {ing.name}
                          </Text>
                          {ing.amount ? (
                            <Text
                              style={[
                                styles.ingredientAmountText,
                                isCookingMode && isChecked && styles.checkedLineText,
                              ]}
                            >
                              {ing.amount}
                            </Text>
                          ) : null}
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    <Text style={styles.detailText}>材料の記載がありません</Text>
                  )}
                </View>

                {/* 6. 作り方セクション（工程ごとに区切って見やすく表示） */}
                <View style={styles.detailSection}>
                  <View style={styles.detailSectionHeaderRow}>
                    <Text style={styles.sectionHeader}>手順</Text>
                    {isCookingMode ? (
                      <Text style={{ fontSize: 11.5, color: theme.textMuted }}>
                        タップで完了チェック
                      </Text>
                    ) : null}
                  </View>

                  {parsedSteps.length > 0 ? (
                    parsedSteps.map((step, idx) => {
                      const isChecked = !!checkedSteps[idx];
                      return (
                        <TouchableOpacity
                          key={`step_${idx}`}
                          activeOpacity={isCookingMode ? 0.7 : 1}
                          onPress={() => isCookingMode && toggleStepCheck(idx)}
                          style={[
                            styles.stepRow,
                            idx === parsedSteps.length - 1 && { borderBottomWidth: 0 },
                          ]}
                        >
                          <View
                            style={[
                              styles.stepNumBadge,
                              isCookingMode && isChecked && styles.stepNumBadgeChecked,
                            ]}
                          >
                            <Text
                              style={[
                                styles.stepNumBadgeText,
                                isCookingMode && isChecked && styles.stepNumBadgeTextChecked,
                              ]}
                            >
                              {step.stepNumber}
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.stepBodyText,
                              isCookingMode && isChecked && styles.checkedLineText,
                            ]}
                          >
                            {step.text}
                          </Text>
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    <Text style={styles.detailText}>{normalizedRecipe.extractedText}</Text>
                  )}

                  {/* 要件3-2：手順エリア直下の「コツ・写真確認」誘導バナー */}
                  <CreatorTipsBanner
                    sourceUrl={normalizedRecipe.sourceUrl}
                    sourcePlatform={normalizedRecipe.sourcePlatform}
                    creatorName={normalizedRecipe.creatorName}
                    styles={styles}
                    theme={theme}
                    onOpenUrl={handleOpenWebPage}
                  />
                </View>
              </>
            )}

            {/* 7. 味調整・感想メモ */}
            {normalizedRecipe.notes ? (
              <View style={styles.noteSection}>
                <Text style={styles.noteSectionHeader}>わが家の味調整メモ</Text>
                <Text style={styles.noteText}>{normalizedRecipe.notes}</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.noteSectionEmpty}
                onPress={() => handleEditPress(normalizedRecipe)}
              >
                <Ionicons name="create-outline" size={15} color={theme.textMuted} style={{ marginRight: 6 }} />
                <Text style={styles.noteTextEmpty}>味の調整や家族の感想をメモする</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </Animated.View>
      </SafeAreaView>
    );
  }

  // =============================================================
  // サブ画面：編集画面
  // =============================================================
  if (activeSubView === 'edit') {
    const activePlatformMeta = SOURCE_PLATFORMS[sourcePlatform] || SOURCE_PLATFORMS.manual;

    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle={theme.statusBar} backgroundColor={theme.headerBg} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <Animated.View
            style={{
              flex: 1,
              opacity: subViewFadeAnim,
              transform: [{ translateY: subViewSlideAnim }],
            }}
          >
            <View style={styles.header}>
              <View style={styles.headerSideArea}>
                <TouchableOpacity
                  onPress={() => {
                    resetForm();
                    closeSubViewSmoothly();
                  }}
                >
                  <Text style={styles.headerCancelButton}>キャンセル</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.headerTitle} numberOfLines={1}>
                {editingRecipeId ? 'レシピ編集' : 'レシピ登録'}
              </Text>

              <View style={[styles.headerSideArea, { alignItems: 'flex-end' }]}>
                <TouchableOpacity onPress={handleSave} disabled={isLoading}>
                  <Text style={[styles.headerSaveButton, isLoading && { opacity: 0.5 }]}>保存</Text>
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView
              style={styles.content}
              contentContainerStyle={styles.editScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {isLoading ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="large" color={theme.primary} />
                  <Text style={styles.loadingText}>{loadingMessage}</Text>
                </View>
              ) : (
                <>
                  <View style={styles.formCard}>
                    <Text style={styles.formCardHeader}>基本情報</Text>

                    <Text style={styles.fieldLabel}>料理名 <Text style={styles.requiredMark}>*</Text></Text>
                    <TextInput
                      style={styles.inputTitle}
                      value={title}
                      onChangeText={setTitle}
                      placeholder="例: 豚の生姜焼き"
                      placeholderTextColor={theme.textMuted}
                    />

                    <Text style={styles.fieldLabel}>完成写真（自分が調理・撮影したもの）</Text>
                    {foodImageUri ? (
                      <View style={styles.photoPreviewWrapper}>
                        <Image source={{ uri: foodImageUri }} style={styles.foodPhotoPreview} />
                        <TouchableOpacity style={styles.changePhotoBtn} onPress={pickFoodPhoto}>
                          <Text style={styles.changePhotoBtnText}>写真を変更</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity style={styles.photoSelectBox} onPress={pickFoodPhoto} activeOpacity={0.7}>
                        <Ionicons name="camera-outline" size={18} color={theme.textSub} />
                        <Text style={styles.photoSelectText}>完成写真を追加（任意・元サイト画像は非保存）</Text>
                      </TouchableOpacity>
                    )}

                    <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                      <View style={{ width: 110 }}>
                        <Text style={styles.fieldLabel}>調理時間（分）</Text>
                        <TextInput
                          style={styles.inputRegular}
                          value={String(cookingTime)}
                          onChangeText={(val) => setCookingTime(val.replace(/[^0-9]/g, ''))}
                          placeholder="15"
                          placeholderTextColor={theme.textMuted}
                          keyboardType="number-pad"
                        />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.fieldLabel}>用途タグ</Text>
                        <View style={styles.tagToggleRow}>
                          <TouchableOpacity
                            style={[styles.tagToggleBtn, isBento && styles.tagToggleBtnActive]}
                            onPress={() => setIsBento(!isBento)}
                          >
                            <Text style={[styles.tagToggleBtnText, isBento && styles.tagToggleBtnTextActive]}>
                              お弁当
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.tagToggleBtn, isMealPrep && styles.tagToggleBtnActive]}
                            onPress={() => setIsMealPrep(!isMealPrep)}
                          >
                            <Text style={[styles.tagToggleBtnText, isMealPrep && styles.tagToggleBtnTextActive]}>
                              作り置き
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>

                    <Text style={[styles.fieldLabel, { marginTop: 4 }]}>カテゴリー</Text>
                    <View style={styles.categorySelectorRow}>
                      {CATEGORIES.map((cat) => {
                        const isSelected = category === cat.key;
                        return (
                          <TouchableOpacity
                            key={cat.key}
                            style={[styles.categoryChip, isSelected && styles.categoryChipSelected]}
                            onPress={() => setCategory(cat.key)}
                          >
                            <Text
                              style={[
                                styles.categoryChipText,
                                isSelected && styles.categoryChipTextSelected,
                              ]}
                            >
                              {cat.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  <View style={styles.formCard}>
                    <Text style={styles.formCardHeader}>家族の評価・味メモ</Text>

                    <View style={styles.familyRatingContainer}>
                      {members.map((m, mIdx) => {
                        const currentRating = familyRatings[m.id] ?? 0;
                        return (
                          <View
                            key={m.id}
                            style={[
                              styles.familyRatingRow,
                              mIdx === members.length - 1 && { borderBottomWidth: 0 },
                            ]}
                          >
                            <Text style={styles.familyMemberName} numberOfLines={1}>
                              {m.name}
                            </Text>
                            <View style={styles.starButtonGroup}>
                              {RATING_STARS.map((_, starVal) => (
                                <TouchableOpacity
                                  key={starVal}
                                  style={[
                                    styles.starButton,
                                    currentRating === starVal && styles.starButtonActive,
                                  ]}
                                  onPress={() => {
                                    setFamilyRatings((prev) => ({ ...prev, [m.id]: starVal }));
                                    if (starVal > 0) setIsCookedState(true);
                                  }}
                                >
                                  <Text
                                    style={[
                                      styles.starButtonText,
                                      currentRating === starVal && styles.starButtonTextActive,
                                    ]}
                                  >
                                    {starVal === 0 ? '未評価' : '★'.repeat(starVal)}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>
                        );
                      })}
                    </View>

                    <Text style={[styles.fieldLabel, { marginTop: 10 }]}>味の調整メモ</Text>
                    <TextInput
                      style={styles.noteInput}
                      value={notes}
                      onChangeText={setNotes}
                      placeholder="例: 醤油小さじ1多めがわが家の黄金比"
                      placeholderTextColor={theme.textMuted}
                      multiline
                      scrollEnabled={false}
                    />

                    <CreatorSupportActionCard
                      sourceUrl={sourceUrl}
                      sourcePlatform={sourcePlatform}
                      creatorName={creatorName}
                      styles={styles}
                      theme={theme}
                      onOpenUrl={handleOpenWebPage}
                    />
                  </View>

                  <View style={styles.formCard}>
                    <Text style={styles.formCardHeader}>出典情報・レシピ内容</Text>

                    <Text style={styles.fieldLabel}>
                      取得元URL（判定: {activePlatformMeta.label}）
                    </Text>
                    <TextInput
                      style={styles.inputRegular}
                      value={sourceUrl}
                      onChangeText={handleSourceUrlChange}
                      placeholder="https://..."
                      placeholderTextColor={theme.textMuted}
                      autoCapitalize="none"
                      keyboardType="url"
                    />

                    <Text style={styles.fieldLabel}>考案者・クリエイター名</Text>
                    <TextInput
                      style={styles.inputRegular}
                      value={creatorName}
                      onChangeText={setCreatorName}
                      placeholder="例: 料理研究家リュウジ / 白ごはん.com"
                      placeholderTextColor={theme.textMuted}
                    />

                    <Text style={styles.fieldLabel}>表示モード</Text>
                    <View style={styles.tagToggleRow}>
                      <TouchableOpacity
                        style={[styles.tagToggleBtn, isScrapedAllowed && styles.tagToggleBtnActive]}
                        onPress={() => setIsScrapedAllowed(true)}
                      >
                        <Text style={[styles.tagToggleBtnText, isScrapedAllowed && styles.tagToggleBtnTextActive]}>
                          要点インデックス
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.tagToggleBtn, !isScrapedAllowed && styles.tagToggleBtnActive]}
                        onPress={() => setIsScrapedAllowed(false)}
                      >
                        <Text style={[styles.tagToggleBtnText, !isScrapedAllowed && styles.tagToggleBtnTextActive]}>
                          ブックマークのみ
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {isScrapedAllowed ? (
                      <>
                        <Text style={styles.fieldLabel}>材料・手順インデックス</Text>
                        <TextInput
                          style={styles.recipeTextInput}
                          value={extractedText}
                          onChangeText={setExtractedText}
                          placeholder="【材料】&#10;・食材名：分量&#10;【作り方】&#10;① 簡潔な手順..."
                          placeholderTextColor={theme.textMuted}
                          multiline
                          scrollEnabled={false}
                        />
                      </>
                    ) : (
                      <View style={styles.bookmarkProtectedBox}>
                        <Text style={styles.bookmarkProtectedDesc}>
                          本文を保存せず、詳細画面から元ページをアプリ内ブラウザで開くブックマーク形式で保存します。
                        </Text>
                      </View>
                    )}
                  </View>

                  {editingRecipeId ? (
                    isEditingDefault ? (
                      <TouchableOpacity
                        style={styles.resetDefaultBtn}
                        onPress={() => handleResetDefaultRecipe(editingRecipeId)}
                      >
                        <Text style={styles.resetDefaultBtnText}>基本レシピを初期状態に戻す</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.deleteFormBtn}
                        onPress={() => handleDeletePress(editingRecipeId)}
                      >
                        <Text style={styles.deleteFormBtnText}>このレシピを削除する</Text>
                      </TouchableOpacity>
                    )
                  ) : null}
                </>
              )}
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // =============================================================
  // メイン画面
  // =============================================================
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={theme.statusBar} backgroundColor={theme.headerBg} />

      <Animated.View
        style={{
          flex: 1,
          opacity: tabFadeAnim,
          transform: [{ translateY: tabTranslateY }],
        }}
      >
        {/* -----------------------------------------------------------
            タブ1：ホーム画面（おすすめ料理を主役に、空状態はコンパクト化）
        ----------------------------------------------------------- */}
        {currentTab === 'home' && (
          <View style={{ flex: 1 }}>
            <View style={styles.header}>
              <View style={styles.headerSideArea}>
                <Text style={styles.headerDateText}>{todayDateString}</Text>
              </View>
              <Image
                source={require('./assets/logo.png')}
                style={styles.headerLogo}
                resizeMode="contain"
              />
              <View style={[styles.headerSideArea, { alignItems: 'flex-end' }]}>
                <TouchableOpacity
                  style={styles.headerQuickAddBtn}
                  activeOpacity={0.7}
                  onPress={() => setIsAddMenuVisible(true)}
                >
                  <Ionicons name="add-outline" size={20} color={theme.textMain} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView style={styles.homeScrollView}>
              {isHeadlineEnabled && currentSeasonalText ? (
                <TouchableOpacity
                  style={styles.headlineBarHome}
                  activeOpacity={0.8}
                  onPress={() => switchTabSmoothly('recipes')}
                >
                  <Ionicons
                    name={currentSeasonIconName}
                    size={15}
                    color={theme.primary}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.headlineTextHome} numberOfLines={1}>
                    {currentMonth}月の旬: {currentSeasonalText}
                  </Text>
                </TouchableOpacity>
              ) : null}

              {/* 主役：今日のオススメ（最上部に配置） */}
              <View style={styles.homeSectionHeader}>
                <View style={styles.homeSectionTitleRow}>
                  <Ionicons name="sparkles-outline" size={16} color={theme.primary} style={{ marginRight: 5 }} />
                  <Text style={styles.homeSectionTitle}>今日のおすすめ</Text>
                </View>
              </View>
              {recommendedStapleRecipe ? (
                <View style={styles.homeRecommendCard}>
                  <TouchableOpacity
                    style={styles.homeRecommendLeft}
                    activeOpacity={0.75}
                    onPress={() => {
                      setSelectedRecipe(recommendedStapleRecipe);
                      setIsCookingMode(false);
                      openSubViewSmoothly('detail');
                    }}
                  >
                    <View style={styles.homeRecommendTagRow}>
                      <Text style={styles.homeRecommendTag}>
                        {topStarredRecipes.length > 0 ? 'わが家の定番' : 'おすすめ献立'}
                        {recommendedStapleRecipe.cookingTime ? ` · 約${recommendedStapleRecipe.cookingTime}分` : ''}
                      </Text>
                    </View>
                    <Text style={styles.homeRecommendTitle} numberOfLines={1}>
                      {recommendedStapleRecipe.title}
                    </Text>
                    <Text style={styles.homeRecommendSub}>
                      {recommendedStapleRecipe.lastCookedAt
                        ? `前回: ${formatRelativeDate(recommendedStapleRecipe.lastCookedAt)}に調理`
                        : '最近作っていないメニューです'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.homeRecommendBtn}
                    activeOpacity={0.8}
                    onPress={() => {
                      setSelectedRecipe(recommendedStapleRecipe);
                      setIsCookingMode(false);
                      openSubViewSmoothly('detail');
                    }}
                  >
                    <Text style={styles.homeRecommendBtnText}>見る</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {/* 今夜のリクエスト（空状態は1行のスリム枠に縮小） */}
              {isRequestEnabled ? (
                <>
                  <View style={styles.homeSectionHeader}>
                    <View style={styles.homeSectionTitleRow}>
                      <Ionicons name="heart-outline" size={16} color={theme.textSub} style={{ marginRight: 5 }} />
                      <Text style={styles.homeSectionTitle}>リクエスト</Text>
                    </View>
                  </View>
                  {requestedCount > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                      {allRecipes
                        .filter((r) => r.isRequested)
                        .map((item) => (
                          <TouchableOpacity
                            key={item.id}
                            style={[styles.horizontalCard, { borderColor: theme.primaryBorder }]}
                            activeOpacity={0.8}
                            onPress={() => {
                              setSelectedRecipe(item);
                              setIsCookingMode(false);
                              openSubViewSmoothly('detail');
                            }}
                          >
                            {item.foodImageUri ? (
                              <Image source={{ uri: item.foodImageUri }} style={styles.horizontalThumb} />
                            ) : (
                              <View style={[styles.horizontalThumb, styles.horizontalThumbPlaceholder]}>
                                <Text style={{ fontSize: 22 }}>{getCategoryIcon(item.category)}</Text>
                              </View>
                            )}
                            <View style={styles.horizontalCardBody}>
                              <Text style={styles.horizontalCardTitle} numberOfLines={1}>{item.title}</Text>
                              <Text style={{ fontSize: 11, color: theme.primary, fontWeight: '600' }}>
                                リクエスト中
                              </Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                    </ScrollView>
                  ) : (
                    <View style={styles.homeEmptyCard}>
                      <Text style={styles.homeEmptyCardSub}>
                        現在リクエストはありません（レシピ詳細の「食べたい」から追加）
                      </Text>
                    </View>
                  )}
                </>
              ) : null}

              {/* 直近の献立（空状態は1行のスリム枠に縮小） */}
              <View style={styles.homeSectionHeader}>
                <View style={styles.homeSectionTitleRow}>
                  <Ionicons name="time-outline" size={16} color={theme.textSub} style={{ marginRight: 5 }} />
                  <Text style={styles.homeSectionTitle}>直近の履歴</Text>
                </View>
                <TouchableOpacity
                  onPress={() => switchTabSmoothly('calendar')}
                  style={{ flexDirection: 'row', alignItems: 'center' }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '500', color: theme.primary }}>カレンダー</Text>
                  <Ionicons name="chevron-forward-outline" size={14} color={theme.primary} />
                </TouchableOpacity>
              </View>
              {isCookedButtonEnabled && recentCookedRecipes.length > 0 ? (
                <View style={styles.recentMealCard}>
                  {recentCookedRecipes.map((r, idx) => (
                    <TouchableOpacity
                      key={r.id}
                      style={[
                        styles.recentMealRow,
                        idx === recentCookedRecipes.length - 1 && { borderBottomWidth: 0 },
                      ]}
                      activeOpacity={0.7}
                      onPress={() => {
                        setSelectedRecipe(r);
                        setIsCookingMode(false);
                        openSubViewSmoothly('detail');
                      }}
                    >
                      <Text style={styles.recentMealDate}>{formatRelativeDate(r.lastCookedAt)}</Text>
                      <Text style={styles.recentMealTitle} numberOfLines={1}>
                        {r.title}
                      </Text>
                      <Ionicons name="chevron-forward-outline" size={14} color={theme.textMuted} />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={styles.homeEmptyCard}>
                  <Text style={styles.homeEmptyCardSub}>
                    履歴はまだありません（「作った」ボタンでカレンダーに記録されます）
                  </Text>
                </View>
              )}

              {/* 作ってみたい（未調理） */}
              {wantToCookRecipes.length > 0 ? (
                <>
                  <View style={styles.homeSectionHeader}>
                    <View style={styles.homeSectionTitleRow}>
                      <Ionicons name="bookmark-outline" size={16} color={theme.textSub} style={{ marginRight: 5 }} />
                      <Text style={styles.homeSectionTitle}>作ってみたい</Text>
                    </View>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                    {wantToCookRecipes.map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.horizontalCard}
                        activeOpacity={0.8}
                        onPress={() => {
                          setSelectedRecipe(item);
                          setIsCookingMode(false);
                          openSubViewSmoothly('detail');
                        }}
                      >
                        {item.foodImageUri ? (
                          <Image source={{ uri: item.foodImageUri }} style={styles.horizontalThumb} />
                        ) : (
                          <View style={[styles.horizontalThumb, styles.horizontalThumbPlaceholder]}>
                            <Text style={{ fontSize: 22 }}>{getCategoryIcon(item.category)}</Text>
                          </View>
                        )}
                        <View style={styles.horizontalCardBody}>
                          <Text style={styles.horizontalCardTitle} numberOfLines={1}>{item.title}</Text>
                          <View style={styles.horizontalCardMeta}>
                            {item.cookingTime ? (
                              <Text style={{ fontSize: 11, color: theme.textMuted }}>約{item.cookingTime}分</Text>
                            ) : null}
                            {item.creatorName ? (
                              <Text style={{ fontSize: 11, color: theme.textMuted }} numberOfLines={1}>
                                {item.creatorName}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              ) : null}
            </ScrollView>
          </View>
        )}

        {/* -----------------------------------------------------------
            タブ2：レシピ帳画面（写真・料理名・時間を中心にした横長カード、「メモ未入力」と更新日は省く）
        ----------------------------------------------------------- */}
        {currentTab === 'recipes' && (
          <View style={{ flex: 1 }}>
            <View style={styles.header}>
              <View style={styles.headerSideArea} />
              <Text style={styles.headerTitle}>レシピ帳</Text>
              <View style={styles.headerSideArea} />
            </View>

            <View style={styles.searchBarContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="料理名・考案者・食材で検索..."
                placeholderTextColor={theme.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                clearButtonMode="while-editing"
              />

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterTabsScroll}>
                <TouchableOpacity
                  style={[styles.filterTab, filterMode === 'all' && styles.filterTabActive]}
                  onPress={() => setFilterMode('all')}
                >
                  <Text style={[styles.filterTabText, filterMode === 'all' && styles.filterTabTextActive]}>
                    すべて ({allRecipes.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.filterTab, filterMode === 'userOnly' && styles.filterTabActiveUserOnly]}
                  onPress={() => setFilterMode('userOnly')}
                >
                  <Text style={[styles.filterTabText, filterMode === 'userOnly' && styles.filterTabTextActive]}>
                    登録済 ({userRecipeCount})
                  </Text>
                </TouchableOpacity>

                {isRequestEnabled ? (
                  <TouchableOpacity
                    style={[styles.filterTab, filterMode === 'requested' && styles.filterTabActiveRequested]}
                    onPress={() => setFilterMode('requested')}
                  >
                    <Text style={[styles.filterTabText, filterMode === 'requested' && styles.filterTabTextActive]}>
                      食べたい ({requestedCount})
                    </Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  style={[styles.filterTab, filterMode === 'wantToCook' && styles.filterTabActiveWant]}
                  onPress={() => setFilterMode('wantToCook')}
                >
                  <Text style={[styles.filterTabText, filterMode === 'wantToCook' && styles.filterTabTextActive]}>
                    未調理 ({wantToCookCount})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.filterTab, filterMode === 'bento' && styles.filterTabActiveBento]}
                  onPress={() => setFilterMode('bento')}
                >
                  <Text style={[styles.filterTabText, filterMode === 'bento' && styles.filterTabTextActive]}>
                    お弁当
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.filterTab, filterMode === 'mealPrep' && styles.filterTabActiveMealPrep]}
                  onPress={() => setFilterMode('mealPrep')}
                >
                  <Text style={[styles.filterTabText, filterMode === 'mealPrep' && styles.filterTabTextActive]}>
                    作り置き
                  </Text>
                </TouchableOpacity>

                {isShowDefaultRecipes ? (
                  <TouchableOpacity
                    style={[styles.filterTab, filterMode === 'preset' && styles.filterTabActivePreset]}
                    onPress={() => setFilterMode('preset')}
                  >
                    <Text style={[styles.filterTabText, filterMode === 'preset' && styles.filterTabTextActive]}>
                      基本
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </ScrollView>
            </View>

            <FlatList
              data={filteredRecipes}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              refreshing={isRefreshing}
              onRefresh={handlePullToRefresh}
              renderItem={({ item }) => {
                const displayImage = item.foodImageUri;
                const categoryIcon = getCategoryIcon(item.category);
                const isCookedToday = cookedTodayRecipeIdSet.has(item.id);

                return (
                  <SpringCard
                    style={[styles.card, isRequestEnabled && item.isRequested && styles.cardRequestedHighlight]}
                    onPress={() => {
                      setSelectedRecipe(item);
                      setIsCookingMode(false);
                      setCheckedSteps({});
                      setCheckedIngredients({});
                      openSubViewSmoothly('detail');
                    }}
                  >
                    {/* 左：写真（未設定時は料理カテゴリの絵文字） */}
                    {displayImage ? (
                      <Image source={{ uri: displayImage }} style={styles.thumbnail} />
                    ) : (
                      <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
                        <Text style={{ fontSize: 22 }}>{categoryIcon}</Text>
                      </View>
                    )}

                    {/* 中央：料理名・調理時間・カテゴリ/考案者（「メモ未入力」と更新日は表示しない） */}
                    <View style={styles.cardBody}>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {item.title}
                      </Text>

                      <View style={styles.cardMetaInlineRow}>
                        {item.cookingTime ? (
                          <View style={styles.cardMetaItem}>
                            <Ionicons name="time-outline" size={12} color={theme.textMuted} style={{ marginRight: 2 }} />
                            <Text style={styles.cardMetaText}>{item.cookingTime}分</Text>
                          </View>
                        ) : null}

                        {item.category ? (
                          <Text style={styles.cardMetaText}>{item.category}</Text>
                        ) : null}

                        {item.creatorName ? (
                          <Text style={styles.cardMetaText} numberOfLines={1}>
                            · {item.creatorName}
                          </Text>
                        ) : null}

                        {item.isBento ? (
                          <Text style={styles.cardMetaText}>· 弁当</Text>
                        ) : null}

                        {item.isMealPrep ? (
                          <Text style={styles.cardMetaText}>· 作り置き</Text>
                        ) : null}
                      </View>

                      {item.notes ? (
                        <Text style={styles.cardNotes} numberOfLines={1}>
                          {item.notes}
                        </Text>
                      ) : null}
                    </View>

                    {/* 右：補助操作「作った」ボタン（白背景＋薄い枠線でスッキリ配置） */}
                    <TouchableOpacity
                      style={[
                        styles.cardCookedBtn,
                        isCookedToday && styles.cardCookedBtnDoneToday,
                      ]}
                      activeOpacity={0.75}
                      onPress={(e) => {
                        if (e && e.stopPropagation) e.stopPropagation();
                        handleMarkAsCookedToday(item);
                      }}
                    >
                      <Ionicons
                        name={isCookedToday ? 'checkmark-circle' : 'checkmark-circle-outline'}
                        size={14}
                        color={isCookedToday ? theme.accentSage : theme.textSub}
                        style={{ marginRight: 3 }}
                      />
                      <Text
                        style={[
                          styles.cardCookedBtnText,
                          isCookedToday && styles.cardCookedBtnTextDoneToday,
                        ]}
                      >
                        {isCookedToday ? '今日済' : '作った'}
                      </Text>
                    </TouchableOpacity>
                  </SpringCard>
                );
              }}
            />

            {/* コンパクト化した主要CTA「＋ レシピ追加」 */}
            <TouchableOpacity
              style={styles.fab}
              activeOpacity={0.85}
              onPress={() => setIsAddMenuVisible(true)}
            >
              <Ionicons name="add-outline" size={18} color="#FFFFFF" />
              <Text style={styles.fabText}>レシピ追加</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* -----------------------------------------------------------
            タブ3：カレンダー画面（上部説明を縮め、月と日付を主役に。「今日・選択日・記録あり」を明確に区別）
        ----------------------------------------------------------- */}
        {currentTab === 'calendar' && (
          <View style={{ flex: 1 }}>
            <View style={styles.header}>
              <View style={styles.headerSideArea} />
              <Text style={styles.headerTitle}>カレンダー</Text>
              <View style={[styles.headerSideArea, { alignItems: 'flex-end' }]}>
                <TouchableOpacity
                  style={styles.calendarTodayJumpBtn}
                  onPress={handleJumpToCurrentMonth}
                  activeOpacity={0.75}
                >
                  <Text style={styles.calendarTodayJumpBtnText}>今月へ</Text>
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 80 }}>
              {/* 月間カレンダーカード（上部の長い説明枠を省き、月ヘッダー内に統計を集約） */}
              <View style={styles.calendarMonthCard}>
                <View style={styles.calendarMonthHeaderRow}>
                  <TouchableOpacity
                    style={[
                      styles.calendarMonthNavBtn,
                      !canGoPrevMonth && styles.calendarMonthNavBtnDisabled,
                    ]}
                    onPress={() => canGoPrevMonth && handleChangeCalendarMonth(-1)}
                    disabled={!canGoPrevMonth}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="chevron-back-outline" size={16} color={theme.textMain} />
                  </TouchableOpacity>

                  <View style={styles.calendarMonthTitleWrap}>
                    <Text style={styles.calendarMonthTitle}>
                      {calendarYear}年 {calendarMonth + 1}月
                    </Text>
                    <Text style={styles.calendarMonthCountSub}>
                      今月の調理 {currentMonthStats.cookedDays}日 · 計{currentMonthStats.totalDishes}品（1年分保管）
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.calendarMonthNavBtn,
                      !canGoNextMonth && styles.calendarMonthNavBtnDisabled,
                    ]}
                    onPress={() => canGoNextMonth && handleChangeCalendarMonth(1)}
                    disabled={!canGoNextMonth}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="chevron-forward-outline" size={16} color={theme.textMain} />
                  </TouchableOpacity>
                </View>

                {/* 「今日・選択日・記録あり」の視覚凡例 */}
                <View style={styles.calendarLegendRow}>
                  <View style={styles.calendarLegendItem}>
                    <View style={styles.calendarLegendBoxSelected} />
                    <Text style={styles.calendarLegendText}>選択日</Text>
                  </View>
                  <View style={styles.calendarLegendItem}>
                    <View style={styles.calendarLegendBoxToday} />
                    <Text style={styles.calendarLegendText}>今日</Text>
                  </View>
                  <View style={styles.calendarLegendItem}>
                    <View style={styles.calendarLegendBoxCooked} />
                    <Text style={styles.calendarLegendText}>記録あり</Text>
                  </View>
                </View>

                {/* 曜日ヘッダー */}
                <View style={styles.calendarWeekdayRow}>
                  {WEEKDAY_LABELS.map((w, idx) => (
                    <View key={w} style={styles.calendarWeekdayCell}>
                      <Text
                        style={[
                          styles.calendarWeekdayText,
                          idx === 0 && { color: theme.accentBordeaux },
                          idx === 6 && { color: '#3A7CA5' },
                        ]}
                      >
                        {w}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* 週ごとの日付セル */}
                {calendarWeeks.map((week, wIdx) => (
                  <View key={`week_${wIdx}`} style={styles.calendarWeekRow}>
                    {week.map((cell, cIdx) => {
                      if (!cell) {
                        return <View key={`empty_${wIdx}_${cIdx}`} style={styles.calendarDayCellEmpty} />;
                      }

                      const dayEntries = historyByDateMap[cell.dateKey] || [];
                      const hasCooked = dayEntries.length > 0;
                      const isSelected = selectedCalendarDateKey === cell.dateKey;
                      const isToday = cell.dateKey === todayDateKey;

                      return (
                        <TouchableOpacity
                          key={cell.dateKey}
                          style={[
                            styles.calendarDayCell,
                            hasCooked && !isSelected && styles.calendarDayCellHasCooked,
                            isToday && !isSelected && styles.calendarDayCellToday,
                            isSelected && styles.calendarDayCellSelected,
                          ]}
                          activeOpacity={0.75}
                          onPress={() => setSelectedCalendarDateKey(cell.dateKey)}
                        >
                          <Text
                            style={[
                              styles.calendarDayNumber,
                              cell.dayOfWeek === 0 && !isSelected && !isToday && { color: theme.accentBordeaux },
                              cell.dayOfWeek === 6 && !isSelected && !isToday && { color: '#3A7CA5' },
                              isToday && !isSelected && styles.calendarDayNumberToday,
                              isSelected && styles.calendarDayNumberSelected,
                            ]}
                          >
                            {cell.day}
                          </Text>

                          {hasCooked ? (
                            <View style={styles.calendarDayDotRow}>
                              <View
                                style={[
                                  styles.calendarDayDot,
                                  isSelected && styles.calendarDayDotSelected,
                                ]}
                              />
                              <Text
                                style={[
                                  styles.calendarDayCountText,
                                  isSelected && styles.calendarDayCountTextSelected,
                                ]}
                              >
                                {dayEntries.length}品
                              </Text>
                            </View>
                          ) : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>

              {/* 選択した日の作ったメニュー一覧 ＆ 取り消し操作 */}
              <View style={styles.calendarDayDetailCard}>
                <View style={styles.calendarDayDetailHeader}>
                  <Text style={styles.calendarDayDetailTitle}>
                    {formatDateKeyJapanese(selectedCalendarDateKey)}のメニュー
                  </Text>
                  <Text style={styles.calendarDayDetailCountText}>
                    {selectedDateEntries.length}品
                  </Text>
                </View>

                {selectedDateEntries.length === 0 ? (
                  <View style={{ paddingVertical: 10 }}>
                    <Text style={{ fontSize: 13, color: theme.textMuted }}>
                      この日の調理記録はありません。各レシピの「作った」ボタンから記録できます。
                    </Text>
                  </View>
                ) : (
                  selectedDateEntries.map((entry, idx) => {
                    const matchedRecipe = allRecipes.find((r) => r.id === entry.recipeId);
                    const catIcon = getCategoryIcon(matchedRecipe?.category || entry.category);

                    return (
                      <View
                        key={entry.id}
                        style={[
                          styles.calendarCookedItemRow,
                          idx === selectedDateEntries.length - 1 && { borderBottomWidth: 0 },
                        ]}
                      >
                        <TouchableOpacity
                          style={styles.calendarCookedItemMain}
                          activeOpacity={0.75}
                          onPress={() => {
                            if (matchedRecipe) {
                              setSelectedRecipe(matchedRecipe);
                              setIsCookingMode(false);
                              setCheckedSteps({});
                              setCheckedIngredients({});
                              openSubViewSmoothly('detail');
                            }
                          }}
                        >
                          <View style={styles.calendarCookedItemIconBox}>
                            <Text style={{ fontSize: 16 }}>{catIcon}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.calendarCookedItemTitle} numberOfLines={1}>
                              {matchedRecipe?.title || entry.title}
                            </Text>
                            <Text style={styles.calendarCookedItemSub}>
                              {matchedRecipe?.category || entry.category || '主菜'}
                            </Text>
                          </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.calendarDeleteEntryBtn}
                          activeOpacity={0.75}
                          onPress={() => handleDeleteCalendarEntry(entry)}
                        >
                          <Ionicons name="trash-outline" size={13} color={theme.accentBordeaux} />
                          <Text style={styles.calendarDeleteEntryBtnText}>消す</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })
                )}
              </View>
            </ScrollView>
          </View>
        )}

        {/* -----------------------------------------------------------
            タブ4：買い物リスト画面（空状態の説明を短くし、入力欄と追加操作に視線を集める）
        ----------------------------------------------------------- */}
        {currentTab === 'shopping' && (
          <View style={{ flex: 1 }}>
            <View style={styles.header}>
              <View style={styles.headerSideArea} />
              <Text style={styles.headerTitle}>買い物リスト</Text>
              <View style={[styles.headerSideArea, { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'flex-end', gap: 10, width: 120 }]}>
                {shoppingList.some((i) => i.checked) ? (
                  <TouchableOpacity onPress={handleClearBoughtItems}>
                    <Text style={styles.clearBoughtText}>完了分を消去</Text>
                  </TouchableOpacity>
                ) : null}
                {shoppingList.length > 0 ? (
                  <TouchableOpacity onPress={handleClearAllShoppingList}>
                    <Text style={styles.clearAllText}>全消去</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            <View style={styles.addShoppingBar}>
              <TextInput
                style={styles.addShoppingInput}
                value={manualItemInput}
                onChangeText={setManualItemInput}
                placeholder="食材や日用品を入力..."
                placeholderTextColor={theme.textMuted}
                onSubmitEditing={handleAddManualShoppingItem}
              />
              <TouchableOpacity style={styles.addShoppingBtn} onPress={handleAddManualShoppingItem}>
                <Text style={styles.addShoppingBtnText}>追加</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 80 }}>
              {shoppingList.length === 0 ? (
                <View style={styles.homeEmptyCard}>
                  <Ionicons name="cart-outline" size={16} color={theme.textMuted} style={{ marginRight: 8 }} />
                  <Text style={styles.homeEmptyCardSub}>
                    リストは空です。上の入力欄またはレシピ詳細から追加できます。
                  </Text>
                </View>
              ) : (
                SHOPPING_AISLES.map((aisle) => {
                  const aisleItems = shoppingList.filter((item) => item.aisle === aisle.key);
                  if (aisleItems.length === 0) return null;

                  return (
                    <View key={aisle.key} style={styles.formCard}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <Ionicons name={aisle.icon} size={15} color={theme.textSub} style={{ marginRight: 6 }} />
                        <Text style={styles.formCardHeaderNoBorder}>{aisle.label}</Text>
                      </View>
                      <View>
                        {aisleItems.map((item, idx) => (
                          <View
                            key={item.id}
                            style={[
                              styles.shoppingItemRow,
                              item.checked && styles.shoppingItemRowChecked,
                              idx === aisleItems.length - 1 && { borderBottomWidth: 0 },
                            ]}
                          >
                            <TouchableOpacity
                              style={styles.shoppingItemCheckArea}
                              onPress={() => handleToggleShoppingItem(item.id)}
                              activeOpacity={0.7}
                            >
                              <Ionicons
                                name={item.checked ? 'checkbox' : 'square-outline'}
                                size={18}
                                color={item.checked ? theme.accentSage : theme.textMuted}
                              />
                              <Text
                                style={[
                                  styles.shoppingItemText,
                                  item.checked && styles.shoppingItemTextChecked,
                                ]}
                              >
                                {item.name}
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.shoppingItemDeleteBtn}
                              onPress={() => handleDeleteShoppingItem(item.id)}
                            >
                              <Ionicons name="close-outline" size={18} color={theme.textMuted} />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        )}

        {/* -----------------------------------------------------------
            タブ5：設定画面（大きな説明カードの連続を廃止し、見出し＋設定項目のシンプルな並びに整理）
        ----------------------------------------------------------- */}
        {currentTab === 'settings' && (
          <View style={{ flex: 1 }}>
            <View style={styles.header}>
              <View style={styles.headerSideArea} />
              <Text style={styles.headerTitle}>設定</Text>
              <View style={styles.headerSideArea} />
            </View>

            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 80 }}>
              {/* 1. 表示・機能設定（1行リスト形式でスッキリ並べる） */}
              <Text style={styles.settingsSectionHeader}>表示・機能設定</Text>
              <View style={styles.settingsGroupCard}>
                <View style={styles.settingsRow}>
                  <Text style={styles.settingsRowLabel}>テーマ</Text>
                  <View style={styles.settingsSegmentGroup}>
                    <TouchableOpacity
                      style={[styles.settingsSegmentBtn, !isDarkMode && styles.settingsSegmentBtnActive]}
                      onPress={() => updateSetting('@setting_dark_mode', false, setIsDarkMode)}
                    >
                      <Text style={[styles.settingsSegmentText, !isDarkMode && styles.settingsSegmentTextActive]}>
                        ライト
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.settingsSegmentBtn, isDarkMode && styles.settingsSegmentBtnActive]}
                      onPress={() => updateSetting('@setting_dark_mode', true, setIsDarkMode)}
                    >
                      <Text style={[styles.settingsSegmentText, isDarkMode && styles.settingsSegmentTextActive]}>
                        ダーク
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.settingsRow}>
                  <Text style={styles.settingsRowLabel}>基本調味料を買い物から除外</Text>
                  <View style={styles.settingsSegmentGroup}>
                    <TouchableOpacity
                      style={[styles.settingsSegmentBtn, isExcludeStapleSeasonings && styles.settingsSegmentBtnActive]}
                      onPress={() => updateSetting('@setting_exclude_staple_seasonings', true, setIsExcludeStapleSeasonings)}
                    >
                      <Text style={[styles.settingsSegmentText, isExcludeStapleSeasonings && styles.settingsSegmentTextActive]}>
                        ON
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.settingsSegmentBtn, !isExcludeStapleSeasonings && styles.settingsSegmentBtnActive]}
                      onPress={() => updateSetting('@setting_exclude_staple_seasonings', false, setIsExcludeStapleSeasonings)}
                    >
                      <Text style={[styles.settingsSegmentText, !isExcludeStapleSeasonings && styles.settingsSegmentTextActive]}>
                        OFF
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.settingsRow}>
                  <Text style={styles.settingsRowLabel}>調理モード（スリープ防止）</Text>
                  <View style={styles.settingsSegmentGroup}>
                    <TouchableOpacity
                      style={[styles.settingsSegmentBtn, isCookingModeEnabled && styles.settingsSegmentBtnActive]}
                      onPress={() => updateSetting('@setting_cooking_mode_enabled', true, setIsCookingModeEnabled)}
                    >
                      <Text style={[styles.settingsSegmentText, isCookingModeEnabled && styles.settingsSegmentTextActive]}>
                        ON
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.settingsSegmentBtn, !isCookingModeEnabled && styles.settingsSegmentBtnActive]}
                      onPress={() => updateSetting('@setting_cooking_mode_enabled', false, setIsCookingModeEnabled)}
                    >
                      <Text style={[styles.settingsSegmentText, !isCookingModeEnabled && styles.settingsSegmentTextActive]}>
                        OFF
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.settingsRow}>
                  <Text style={styles.settingsRowLabel}>食べたいリクエスト機能</Text>
                  <View style={styles.settingsSegmentGroup}>
                    <TouchableOpacity
                      style={[styles.settingsSegmentBtn, isRequestEnabled && styles.settingsSegmentBtnActive]}
                      onPress={() => updateSetting('@setting_request_enabled', true, setIsRequestEnabled)}
                    >
                      <Text style={[styles.settingsSegmentText, isRequestEnabled && styles.settingsSegmentTextActive]}>
                        ON
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.settingsSegmentBtn, !isRequestEnabled && styles.settingsSegmentBtnActive]}
                      onPress={() => updateSetting('@setting_request_enabled', false, setIsRequestEnabled)}
                    >
                      <Text style={[styles.settingsSegmentText, !isRequestEnabled && styles.settingsSegmentTextActive]}>
                        OFF
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.settingsRow}>
                  <Text style={styles.settingsRowLabel}>旬食材ヘッドライン</Text>
                  <View style={styles.settingsSegmentGroup}>
                    <TouchableOpacity
                      style={[styles.settingsSegmentBtn, isHeadlineEnabled && styles.settingsSegmentBtnActive]}
                      onPress={() => updateSetting('@setting_headline_enabled', true, setIsHeadlineEnabled)}
                    >
                      <Text style={[styles.settingsSegmentText, isHeadlineEnabled && styles.settingsSegmentTextActive]}>
                        表示
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.settingsSegmentBtn, !isHeadlineEnabled && styles.settingsSegmentBtnActive]}
                      onPress={() => updateSetting('@setting_headline_enabled', false, setIsHeadlineEnabled)}
                    >
                      <Text style={[styles.settingsSegmentText, !isHeadlineEnabled && styles.settingsSegmentTextActive]}>
                        非表示
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.settingsRowNoBorder}>
                  <Text style={styles.settingsRowLabel}>基本レシピ（10品）の表示</Text>
                  <View style={styles.settingsSegmentGroup}>
                    <TouchableOpacity
                      style={[styles.settingsSegmentBtn, isShowDefaultRecipes && styles.settingsSegmentBtnActive]}
                      onPress={() => updateSetting('@setting_show_default_recipes', true, setIsShowDefaultRecipes)}
                    >
                      <Text style={[styles.settingsSegmentText, isShowDefaultRecipes && styles.settingsSegmentTextActive]}>
                        表示
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.settingsSegmentBtn, !isShowDefaultRecipes && styles.settingsSegmentBtnActive]}
                      onPress={() => updateSetting('@setting_show_default_recipes', false, setIsShowDefaultRecipes)}
                    >
                      <Text style={[styles.settingsSegmentText, !isShowDefaultRecipes && styles.settingsSegmentTextActive]}>
                        非表示
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* 2. 家族共有 */}
              <Text style={styles.settingsSectionHeader}>家族共有</Text>
              <View style={styles.settingsGroupCard}>
                <View style={{ paddingVertical: 8 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={styles.fieldLabel}>現在の家族ID</Text>
                    <TouchableOpacity onPress={handleRegenerateFamilyId}>
                      <Text style={styles.regenerateIdBtnText}>IDを再発行</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.familyIdDisplayBox}>
                    <Text style={styles.familyIdText} selectable={true}>{familyId || '発行中...'}</Text>
                    <TouchableOpacity
                      style={styles.familyIdInfoBtn}
                      onPress={() => {
                        const msg = `家族ID: ${familyId}\n家族のスマホの「別の家族IDに参加」欄に入力すると、レシピ帳とカレンダーを共有できます。`;
                        Platform.OS === 'web' ? window.alert(msg) : Alert.alert('共有方法', msg);
                      }}
                    >
                      <Text style={styles.familyIdInfoBtnText}>共有方法</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.fieldLabel, { marginTop: 10 }]}>別の家族IDに参加</Text>
                  <View style={styles.joinFamilyRow}>
                    <TextInput
                      style={styles.joinFamilyInput}
                      value={joinFamilyInput}
                      onChangeText={setJoinFamilyInput}
                      placeholder="例: FAM-XXXX-XXXX"
                      placeholderTextColor={theme.textMuted}
                      autoCapitalize="characters"
                    />
                    <TouchableOpacity style={styles.joinFamilyBtn} onPress={handleJoinFamily}>
                      <Text style={styles.joinFamilyBtnText}>参加</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* 3. 評価メンバー */}
              <Text style={styles.settingsSectionHeader}>評価メンバー（{members.length}/5人）</Text>
              <View style={styles.settingsGroupCard}>
                {members.map((m, idx) => (
                  <View key={m.id} style={styles.memberEditRow}>
                    <Text style={styles.memberIndexLabel}>{idx + 1}.</Text>
                    <TextInput
                      style={styles.memberNameInput}
                      value={m.name}
                      onChangeText={(newName) => handleUpdateMemberName(m.id, newName)}
                      placeholder="メンバー名"
                      placeholderTextColor={theme.textMuted}
                    />
                    {members.length > 1 ? (
                      <TouchableOpacity
                        style={styles.memberDeleteBtn}
                        onPress={() => handleDeleteMember(m.id)}
                      >
                        <Ionicons name="close-outline" size={16} color={theme.textMuted} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))}

                {members.length < 5 ? (
                  <TouchableOpacity
                    style={styles.addMemberBtn}
                    onPress={handleAddMember}
                  >
                    <Text style={styles.addMemberBtnText}>＋ メンバーを追加</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* 4. バックアップ（ラベルを短くし、シンプルなリスト行に整理） */}
              <Text style={styles.settingsSectionHeader}>バックアップ</Text>
              <View style={styles.settingsGroupCard}>
                <TouchableOpacity
                  style={styles.backupActionBtn}
                  onPress={handleExportJsonBackup}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.backupActionTitle}>JSONファイルに書き出す</Text>
                    <Text style={styles.backupActionDesc}>
                      全{allRecipes.length}品のレシピとカレンダー履歴を保存
                    </Text>
                  </View>
                  <Ionicons name="download-outline" size={18} color={theme.textSub} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.backupActionBtn, { borderBottomWidth: 0 }]}
                  onPress={handleCopyTextBackup}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.backupActionTitle}>レシピ一覧テキストをコピー</Text>
                    <Text style={styles.backupActionDesc}>
                      料理名・考案者・メモ・URLをクリップボードへコピー
                    </Text>
                  </View>
                  <Ionicons name="copy-outline" size={17} color={theme.textSub} />
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        )}
      </Animated.View>

      {/* =============================================================
          モーダル①：レシピ追加方法の選択
      ============================================================= */}
      <Modal
        visible={isAddMenuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsAddMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsAddMenuVisible(false)}
        >
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>レシピ追加</Text>
            <Text style={styles.modalSubTitle}>
              取り込み方法を選択してください
            </Text>

            <TouchableOpacity
              style={styles.modalChoiceBtn}
              onPress={() => {
                setIsAddMenuVisible(false);
                setImportUrlText('');
                setIsUrlModalVisible(true);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="globe-outline" size={20} color={theme.primary} style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.modalChoiceTitle}>Web・SNSのURLから登録</Text>
                <Text style={styles.modalChoiceDesc}>
                  YouTube・Instagram・レシピサイトの出典と要点を抽出
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalChoiceBtn}
              onPress={() => {
                setIsAddMenuVisible(false);
                pickRecipeImage();
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="image-outline" size={20} color={theme.primary} style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.modalChoiceTitle}>画像から要点抽出</Text>
                <Text style={styles.modalChoiceDesc}>
                  材料と手順インデックスのみ抽出（元画像は非保存）
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalChoiceBtn}
              onPress={() => {
                setIsAddMenuVisible(false);
                resetForm();
                openSubViewSmoothly('edit');
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="create-outline" size={20} color={theme.primary} style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.modalChoiceTitle}>手動で入力</Text>
                <Text style={styles.modalChoiceDesc}>わが家のオリジナルレシピを直接入力</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setIsAddMenuVisible(false)}
            >
              <Text style={styles.modalCancelBtnText}>キャンセル</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* =============================================================
          モーダル②：URL入力モーダル
      ============================================================= */}
      <Modal
        visible={isUrlModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsUrlModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>URLからレシピを取り込む</Text>
            <Text style={styles.modalSubTitle}>
              YouTube、Instagram、X、レシピサイトのURLを入力してください
            </Text>

            <TextInput
              style={styles.modalInput}
              value={importUrlText}
              onChangeText={setImportUrlText}
              placeholder="https://..."
              placeholderTextColor={theme.textMuted}
              autoCapitalize="none"
              keyboardType="url"
              clearButtonMode="while-editing"
            />

            <TouchableOpacity
              style={styles.modalSubmitBtn}
              onPress={handleProcessUrlImport}
              activeOpacity={0.8}
            >
              <Text style={styles.modalSubmitBtnText}>出典を明記して抽出する</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setIsUrlModalVisible(false)}
            >
              <Text style={styles.modalCancelBtnText}>キャンセル</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* =============================================================
          モーダル③：「作った！」記録完了 ＆ 家族評価 ＆ クリエイター応援モーダル
      ============================================================= */}
      <Modal
        visible={isCookingCompleteModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsCookingCompleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>カレンダーに記録しました</Text>
            <Text style={styles.modalSubTitle}>
              「{completedRecipe?.title}」を{formatDateKeyJapanese(selectedCalendarDateKey)}のメニューに登録しました
            </Text>

            {completedRecipe ? (
              <View style={[styles.familyRatingContainer, { marginBottom: 10 }]}>
                {members.map((m, mIdx) => {
                  const currentRating = completedRecipe.familyRatings?.[m.id] ?? 0;
                  return (
                    <View
                      key={m.id}
                      style={[
                        styles.familyRatingRow,
                        mIdx === members.length - 1 && { borderBottomWidth: 0 },
                      ]}
                    >
                      <Text style={styles.familyMemberName} numberOfLines={1}>
                        {m.name}
                      </Text>
                      <View style={styles.starButtonGroup}>
                        {RATING_STARS.map((_, starVal) => (
                          <TouchableOpacity
                            key={starVal}
                            style={[
                              styles.starButton,
                              currentRating === starVal && styles.starButtonActive,
                            ]}
                            onPress={() => handleQuickRateInCompleteModal(m.id, starVal)}
                          >
                            <Text
                              style={[
                                styles.starButtonText,
                                currentRating === starVal && styles.starButtonTextActive,
                              ]}
                            >
                              {starVal === 0 ? '未評価' : '★'.repeat(starVal)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : null}

            {completedRecipe ? (
              <CreatorSupportActionCard
                sourceUrl={completedRecipe.sourceUrl}
                sourcePlatform={completedRecipe.sourcePlatform}
                creatorName={completedRecipe.creatorName}
                styles={styles}
                theme={theme}
                onOpenUrl={handleOpenWebPage}
              />
            ) : null}

            <TouchableOpacity
              style={[styles.modalSubmitBtn, { marginTop: 8 }]}
              onPress={() => {
                setIsCookingCompleteModalVisible(false);
                closeSubViewSmoothly();
                switchTabSmoothly('calendar');
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.modalSubmitBtnText}>カレンダーで確認する</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setIsCookingCompleteModalVisible(false)}
            >
              <Text style={styles.modalCancelBtnText}>閉じる</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={styles.bottomNavBar}>
        {NAV_ITEMS.map((tab) => (
          <NavTabButton
            key={tab.key}
            tab={tab}
            currentTab={currentTab}
            onPress={() => switchTabSmoothly(tab.key)}
            styles={styles}
            unboughtCount={unboughtCount}
            theme={theme}
          />
        ))}
      </View>
    </SafeAreaView>
  );
}
