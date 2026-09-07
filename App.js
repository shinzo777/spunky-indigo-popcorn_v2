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
  Linking,
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
  getSeasonIcon,
} from './constants';

import {
  categorizeIngredient,
  extractIngredientsFromRecipeText,
  generateNewFamilyId,
  formatRelativeDate,
  processAssetForUpload,
  compressImageForFirestore,
  scaleIngredientLine,
} from './helpers';

import { getStyles } from './styles';

// =============================================================
// ★ 触感マイクロインタラクション（タップ時にほんの少しクニュッと沈み込む）
// =============================================================
const SpringCard = ({ children, onPress, style, ...props }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.975,
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
      {...props}
    >
      <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

// =============================================================
// ナビゲーションバーのフェードアウトボタン
// =============================================================
const NavTabButton = ({ tab, currentTab, onPress, styles, unboughtCount, theme }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const isActive = currentTab === tab.key;

  const handlePressIn = () => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 50,
      useNativeDriver: false,
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 350,
      useNativeDriver: false,
    }).start();
  };

  const backgroundColor = fadeAnim.interpolate({
    inputRange: Array.of(0, 1),
    outputRange: ['rgba(200, 90, 23, 0)', 'rgba(200, 90, 23, 0.15)'],
  });

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      style={{ flex: 1 }}
    >
      <Animated.View style={[styles.navTabItem, { backgroundColor }]}>
        <View style={{ position: 'relative' }}>
          <Ionicons
            name={isActive ? tab.activeIconName : tab.iconName}
            size={22}
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
      </Animated.View>
    </Pressable>
  );
};

export default function App() {
  const [cloudRecipes, setCloudRecipes] = useState([]);
  const [currentTab, setCurrentTab] = useState('home');
  const [activeSubView, setActiveSubView] = useState(null); // null | 'detail' | 'edit'

  // ★ シームレスなタブ遷移アニメーション
  const tabFadeAnim = useRef(new Animated.Value(1)).current;
  const tabTranslateY = useRef(new Animated.Value(0)).current;

  // ★ サブ画面（詳細・編集）のシームレススライドインアニメーション
  const subViewFadeAnim = useRef(new Animated.Value(0)).current;
  const subViewSlideAnim = useRef(new Animated.Value(24)).current;

  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

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
  const [imageUri, setImageUri] = useState(null);
  const [foodImageUri, setFoodImageUri] = useState(null);
  const [webUrl, setWebUrl] = useState('');
  const [title, setTitle] = useState('');
  const [extractedText, setExtractedText] = useState('');
  const [notes, setNotes] = useState('');
  const [cookingTime, setCookingTime] = useState(15);
  const [isBento, setIsBento] = useState(false);
  const [isMealPrep, setIsMealPrep] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  const [isCookingMode, setIsCookingMode] = useState(false);
  const [checkedLines, setCheckedLines] = useState({});
  const [servingSize, setServingSize] = useState(2);

  const theme = isDarkMode ? THEMES.dark : THEMES.light;
  const styles = useMemo(() => getStyles(theme), [theme]);

  const currentMonth = new Date().getMonth() + 1;
  const currentSeasonIcon = getSeasonIcon(currentMonth);
  const currentSeasonalText = MONTHLY_SEASONAL_MAP[currentMonth] || '';

  const firestoreFamilyApiUrl = useMemo(() => {
    if (!FIREBASE_PROJECT_ID || !familyId) return null;
    return `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/families/${familyId}/recipes`;
  }, [familyId]);

  const firestoreShoppingApiUrl = useMemo(() => {
    if (!FIREBASE_PROJECT_ID || !familyId) return null;
    return `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/families/${familyId}/shopping/list`;
  }, [familyId]);

  const allRecipes = useMemo(() => {
    if (!isShowDefaultRecipes) {
      return cloudRecipes.filter((r) => !r.isDefault);
    }
    const presetMap = new Map();
    PRESET_DEFAULT_RECIPES.forEach((p) => presetMap.set(p.id, p));
    cloudRecipes.forEach((r) => presetMap.set(r.id, r));
    return Array.from(presetMap.values());
  }, [cloudRecipes, isShowDefaultRecipes]);

  // タブ切り替え時のなめらかアニメーション
  const switchTabSmoothly = (newTab) => {
    if (newTab === currentTab) return;
    tabFadeAnim.setValue(0.3);
    tabTranslateY.setValue(10);
    setCurrentTab(newTab);
    Animated.parallel([
      Animated.timing(tabFadeAnim, { toValue: 1, duration: 220, useNativeDriver: false }),
      Animated.timing(tabTranslateY, { toValue: 0, duration: 220, useNativeDriver: false }),
    ]).start();
  };

  // サブ画面を開く（なめらかなスライドイン）
  const openSubViewSmoothly = (viewName) => {
    subViewFadeAnim.setValue(0);
    subViewSlideAnim.setValue(24);
    setActiveSubView(viewName);
    Animated.parallel([
      Animated.timing(subViewFadeAnim, { toValue: 1, duration: 250, useNativeDriver: false }),
      Animated.timing(subViewSlideAnim, { toValue: 0, duration: 250, useNativeDriver: false }),
    ]).start();
  };

  // サブ画面を閉じる（なめらかなスライドアウト）
  const closeSubViewSmoothly = () => {
    Animated.parallel([
      Animated.timing(subViewFadeAnim, { toValue: 0, duration: 180, useNativeDriver: false }),
      Animated.timing(subViewSlideAnim, { toValue: 24, duration: 180, useNativeDriver: false }),
    ]).start(() => {
      setActiveSubView(null);
    });
  };

  useEffect(() => {
    const timer = setTimeout(() => setIsAppReady(true), 1200);

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

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!firestoreFamilyApiUrl) return;
    fetchRecipesFromCloud();
    fetchShoppingListFromCloud();
    const interval = setInterval(() => {
      fetchRecipesFromCloud();
      fetchShoppingListFromCloud();
    }, 12000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firestoreFamilyApiUrl, firestoreShoppingApiUrl]);

  const updateSetting = async (key, value, setter) => {
    setter(value);
    try {
      await AsyncStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    } catch (e) {
      console.error(e);
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
      const msg = isExcludeStapleSeasonings
        ? '追加する生鮮食材がありませんでした（基本調味料は除外されています）。'
        : 'レシピから材料が見つかりませんでした。';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('案内', msg);
      return;
    }
    const updated = [...shoppingList, ...extracted];
    saveShoppingList(updated);

    const suffix = isExcludeStapleSeasonings ? '\n（※基本調味料は除外されました）' : '';
    const successMsg = `「${recipe.title}」の材料（${extracted.length}品）を買い物リストに追加しました！${suffix}`;
    Platform.OS === 'web' ? window.alert(successMsg) : Alert.alert('追加完了', successMsg);
  };

  const handleClearAllShoppingList = () => {
    if (shoppingList.length === 0) return;
    const msg = '買い物リストの全アイテムを消去しますか？';
    const executeClear = () => saveShoppingList([]);

    if (Platform.OS === 'web') {
      if (window.confirm(msg)) executeClear();
    } else {
      Alert.alert('リスト全消去', msg, [
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

  const handleMarkAsCookedToday = async (recipe) => {
    if (!firestoreFamilyApiUrl) return;
    const wasUncooked = !recipe.isCooked;
    const todayStr = new Date().toISOString();
    const updated = {
      ...recipe,
      lastCookedAt: todayStr,
      isCooked: true,
      isRequested: false,
    };

    setSelectedRecipe(updated);
    setCloudRecipes((prev) =>
      prev.map((r) => (r.id === recipe.id ? updated : r))
    );

    try {
      const updateUrl = `${firestoreFamilyApiUrl}/${recipe.id}?updateMask.fieldPaths=data`;
      await fetch(updateUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: { data: { stringValue: JSON.stringify(updated) } },
        }),
      });

      if (wasUncooked) {
        if (Platform.OS === 'web') {
          if (window.confirm('初調理おめでとうございます！🎉\n家族の評価や味メモを記録して定番にしますか？')) {
            handleEditPress(updated);
          }
        } else {
          Alert.alert('初調理おめでとうございます！🎉', '家族の星評価や味の調整メモを記録しましょう！', [
            { text: '評価・メモを書く', onPress: () => handleEditPress(updated) },
            { text: 'あとで', style: 'cancel' },
          ]);
        }
      } else {
        const msg = `「${recipe.title}」を今日作った料理に記録しました！`;
        Platform.OS === 'web' ? window.alert(msg) : Alert.alert('記録完了', msg);
      }
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

    const confirmMsg = `家族ID「${input}」のレシピ帳に参加しますか？`;
    const doJoin = async () => {
      await AsyncStorage.setItem('@setting_family_id', input);
      setFamilyId(input);
      setJoinFamilyInput('');
      setCloudRecipes([]);
      switchTabSmoothly('recipes');
      const sMsg = `家族グループ「${input}」に合流しました！`;
      Platform.OS === 'web' ? window.alert(sMsg) : Alert.alert('完了', sMsg);
    };

    if (Platform.OS === 'web') {
      if (window.confirm(confirmMsg)) doJoin();
    } else {
      Alert.alert('家族グループの切り替え', confirmMsg, [
        { text: 'キャンセル', style: 'cancel' },
        { text: '参加する', onPress: doJoin },
      ]);
    }
  };

  const handleRegenerateFamilyId = () => {
    const confirmMsg = '新しい高セキュリティな家族ID（8桁形式）を再発行しますか？';
    const doRegen = async () => {
      const newId = generateNewFamilyId();
      await AsyncStorage.setItem('@setting_family_id', newId);
      setFamilyId(newId);
      setCloudRecipes([]);
      const msg = `新しい家族ID: ${newId} を発行しました！`;
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('完了', msg);
    };

    if (Platform.OS === 'web') {
      if (window.confirm(confirmMsg)) doRegen();
    } else {
      Alert.alert('家族IDの再発行', confirmMsg, [
        { text: 'キャンセル', style: 'cancel' },
        { text: '再発行する', onPress: doRegen },
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
            return { id, ...parsed };
          } catch (e) {
            return { id, title: 'データ取得エラー' };
          }
        }
        return { id };
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
    setIsRefreshing(false);
  };

  const handleToggleRequest = async (recipe) => {
    if (!firestoreFamilyApiUrl) return;
    const nextRequested = !recipe.isRequested;
    const updatedRecipe = { ...recipe, isRequested: nextRequested };

    setSelectedRecipe(updatedRecipe);
    setCloudRecipes((prev) =>
      prev.map((r) => (r.id === recipe.id ? updatedRecipe : r))
    );

    try {
      const updateUrl = `${firestoreFamilyApiUrl}/${recipe.id}?updateMask.fieldPaths=data`;
      const payload = { ...recipe, isRequested: nextRequested };

      await fetch(updateUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: { data: { stringValue: JSON.stringify(payload) } },
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
      setCheckedLines({});
    }
    setIsCookingMode((prev) => !prev);
  };

  const toggleLineCheck = (index) => {
    setCheckedLines((prev) => ({ ...prev, [index]: !prev[index] }));
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

  const recommendedStapleRecipe = useMemo(() => {
    if (topStarredRecipes.length === 0) return null;
    const sorted = [...topStarredRecipes].sort((a, b) => {
      const tA = a.lastCookedAt ? new Date(a.lastCookedAt).getTime() : 0;
      const tB = b.lastCookedAt ? new Date(b.lastCookedAt).getTime() : 0;
      return tA - tB;
    });
    return sorted[0] || null;
  }, [topStarredRecipes]);

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
          r.webUrl?.toLowerCase().includes(query)
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

  const pickRecipeImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.35,
        base64: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const processed = await processAssetForUpload(result.assets[0]);
      if (!processed || !processed.base64) {
        const msg = '画像の読み込みに失敗しました';
        Platform.OS === 'web' ? window.alert(msg) : Alert.alert('画像エラー', msg);
        return;
      }

      setImageUri(processed.dataUri);
      setEditingRecipeId(null);
      setIsEditingDefault(false);
      setIsCookedState(false);
      setCookingTime(15);
      setIsBento(false);
      setIsMealPrep(false);

      const defaultRatings = {};
      members.forEach((m) => {
        defaultRatings[m.id] = 0;
      });
      setFamilyRatings(defaultRatings);
      openSubViewSmoothly('edit');

      setIsLoading(true);
      setLoadingMessage('AIがレシピを文字起こし中...');
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
        body: JSON.stringify({ base64Data, mimeType }),
      });

      const json = await response.json();
      if (!response.ok) {
        const msg = json.error?.message || json.error || '通信に失敗しました';
        Platform.OS === 'web' ? window.alert(`解析エラー: ${msg}`) : Alert.alert('解析エラー', msg);
        return;
      }

      const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const lines = text.split('\n').filter((l) => l.trim() !== '');
        const autoTitle = lines[0]?.replace(/[#*]/g, '').trim() || '無題のレシピ';
        setTitle(autoTitle);
        setExtractedText(text);
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
      const msg = '家族グループIDが取得できていません';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('エラー', msg);
      return;
    }

    const hasAnyRating = Object.values(familyRatings).some((v) => v > 0);
    const finalCookedState = isCookedState || hasAnyRating;

    const cleanImageUri = await compressImageForFirestore(imageUri);
    const cleanFoodImageUri = await compressImageForFirestore(foodImageUri);

    const payload = {
      title: title.trim(),
      category: category || 'その他',
      familyRatings: familyRatings || {},
      extractedText,
      notes,
      cookingTime: Number(cookingTime) || 15,
      isBento: !!isBento,
      isMealPrep: !!isMealPrep,
      imageUri: cleanImageUri || null,
      foodImageUri: cleanFoodImageUri || null,
      webUrl: webUrl.trim(),
      updatedAt: new Date().toLocaleDateString('ja-JP'),
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
      resetForm();
      closeSubViewSmoothly();
    } catch (e) {
      const msg = e.message;
      Platform.OS === 'web' ? window.alert(`保存エラー: ${msg}`) : Alert.alert('保存エラー', msg);
    }
  };

  const handleEditPress = (recipe) => {
    setEditingRecipeId(recipe.id);
    setIsEditingDefault(!!recipe.isDefault);
    setIsCookedState(!!recipe.isCooked);
    setTitle(recipe.title);
    setCategory(recipe.category || '主菜');
    setFamilyRatings(recipe.familyRatings || {});
    setExtractedText(recipe.extractedText);
    setNotes(recipe.notes || '');
    setCookingTime(recipe.cookingTime || 15);
    setIsBento(!!recipe.isBento);
    setIsMealPrep(!!recipe.isMealPrep);
    setImageUri(recipe.imageUri || null);
    setFoodImageUri(recipe.foodImageUri || null);
    setWebUrl(recipe.webUrl || '');
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
      if (window.confirm('このレシピを初期状態（オリジナルの材料・手順・メモ）に戻しますか？')) {
        executeReset();
      }
    } else {
      Alert.alert('基本レシピのリセット', 'このレシピを初期状態に戻しますか？', [
        { text: 'キャンセル', style: 'cancel' },
        { text: 'リセットする', onPress: executeReset },
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
      if (window.confirm('このレシピを削除してもよろしいですか？\n（同じ家族グループの全員から削除されます）')) {
        executeDelete();
      }
    } else {
      Alert.alert('レシピの削除', 'このレシピを削除してもよろしいですか？\n（同じ家族グループの全員から削除されます）', [
        { text: 'キャンセル', style: 'cancel' },
        { text: '削除', style: 'destructive', onPress: executeDelete },
      ]);
    }
  };

  const handleOpenWebPage = async (url) => {
    if (!url) return;
    let target = url.trim();
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      target = 'https://' + target;
    }
    try {
      const encodedUrl = encodeURI(target);
      await Linking.openURL(encodedUrl);
    } catch (err) {
      const msg = 'Webページを開けませんでした。';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('エラー', msg);
    }
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
    setImageUri(null);
    setFoodImageUri(null);
    setWebUrl('');
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
          style={{ width: 180, height: 60, marginBottom: 12 }}
          resizeMode="contain"
        />
        <Text style={{ fontSize: 13, color: '#5C4033', fontWeight: 'bold', letterSpacing: 2 }}>
          わが家のレシピ帳
        </Text>
      </View>
    );
  }

  // =============================================================
  // サブ画面：詳細画面（シームレスアニメーション付き）
  // =============================================================
  if (activeSubView === 'detail' && selectedRecipe) {
    const mainImage = selectedRecipe.foodImageUri || selectedRecipe.imageUri;
    const categoryIcon = getCategoryIcon(selectedRecipe.category);

    const rawLines = (selectedRecipe.extractedText || '')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    const unscaledLines =
      rawLines.length > 0 && rawLines[0].replace(/[#*]/g, '').trim() === selectedRecipe.title.trim()
        ? rawLines.slice(1)
        : rawLines;

    // ★ 材料のみを安全に倍量計算（作り方・温度・時間は絶対に変えない）
    const scaleFactor = servingSize / 2;
    let inIngredients = false;

    const recipeLines = unscaledLines.map((line) => {
      if (/材料|【材料】|〔材料〕|＜材料＞/.test(line)) {
        inIngredients = true;
        return line.replace(/\d+\s*(?:人分|人前)/g, `${servingSize}人分`);
      }
      if (
        /作り方|手順|【作り方】|〔作り方〕|＜作り方＞/.test(line) ||
        /^\d+[\.\、\)]|^[①-⑳]/.test(line)
      ) {
        inIngredients = false;
        return line;
      }
      if (inIngredients) {
        return scaleIngredientLine(line, scaleFactor);
      }
      return line;
    });

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
              <TouchableOpacity onPress={closeSubViewSmoothly}>
                <Text style={styles.headerButton}>‹ 戻る</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.headerTitle}>レシピ詳細</Text>

            <View style={[styles.headerSideArea, { alignItems: 'flex-end' }]}>
              <TouchableOpacity onPress={() => handleEditPress(selectedRecipe)}>
                <Text style={styles.editButtonText}>編集</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 80 }}>
            {mainImage && (
              <Image source={{ uri: mainImage }} style={styles.detailImage} resizeMode="cover" />
            )}

            <View style={styles.detailTitleRow}>
              <Text style={styles.detailTitle}>{selectedRecipe.title}</Text>
            </View>

            <View style={styles.detailTagsRow}>
              {selectedRecipe.category ? (
                <View style={styles.detailTag}>
                  <Text style={styles.detailTagText}>{categoryIcon} {selectedRecipe.category}</Text>
                </View>
              ) : null}
              {selectedRecipe.cookingTime ? (
                <View style={[styles.detailTag, { backgroundColor: '#FEF9E7', borderColor: '#F9E79F' }]}>
                  <Text style={[styles.detailTagText, { color: '#B7950B' }]}>⏱️ 約{selectedRecipe.cookingTime}分</Text>
                </View>
              ) : null}
              {selectedRecipe.isBento ? (
                <View style={[styles.detailTag, { backgroundColor: '#FDF2E9', borderColor: '#F5CBA7' }]}>
                  <Text style={[styles.detailTagText, { color: '#C85A17' }]}>🍱 お弁当OK</Text>
                </View>
              ) : null}
              {selectedRecipe.isMealPrep ? (
                <View style={[styles.detailTag, { backgroundColor: '#EBF5FB', borderColor: '#AED6F1' }]}>
                  <Text style={[styles.detailTagText, { color: '#3A7CA5' }]}>🧊 作り置きOK</Text>
                </View>
              ) : null}
            </View>

            {isCookingModeEnabled ? (
              <SpringCard
                style={[styles.bigCookStartBtn, isCookingMode && styles.bigCookStartBtnActive]}
                onPress={toggleCookingMode}
              >
                <Text style={styles.bigCookStartBtnText}>
                  {isCookingMode ? '🍳 調理終了（履歴に記録）' : '🍳 調理スタート（スリープ防止）'}
                </Text>
              </SpringCard>
            ) : null}

            <View style={styles.smartActionBar}>
              <SpringCard
                style={styles.smartActionBtn}
                onPress={() => handleAddRecipeToShoppingList(selectedRecipe)}
              >
                <Text style={styles.smartActionBtnText}>🛒 買い物追加</Text>
              </SpringCard>

              {isRequestEnabled ? (
                <SpringCard
                  style={[styles.smartActionBtn, selectedRecipe.isRequested && styles.smartActionBtnActiveRequest]}
                  onPress={() => handleToggleRequest(selectedRecipe)}
                >
                  <Text style={[styles.smartActionBtnText, selectedRecipe.isRequested && styles.smartActionBtnTextActive]}>
                    {selectedRecipe.isRequested ? '😋 食べたい中' : '🙋 食べたい！'}
                  </Text>
                </SpringCard>
              ) : null}
            </View>

            {selectedRecipe.notes ? (
              <View style={styles.noteSection}>
                <Text style={styles.noteSectionHeader}>💡 わが家の味調整・メモ</Text>
                <Text style={styles.noteText}>{selectedRecipe.notes}</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.noteSectionEmpty}
                onPress={() => handleEditPress(selectedRecipe)}
              >
                <Text style={styles.noteTextEmpty}>💡 ＋ 味の調整や家族の感想をメモする</Text>
              </TouchableOpacity>
            )}

            <View style={styles.servingContainer}>
              <Text style={styles.servingLabel}>⚖️ 人数・分量計算</Text>
              <View style={styles.servingChips}>
                {Array.of(1, 2, 3, 4).map((size) => (
                  <TouchableOpacity
                    key={size}
                    style={[styles.servingChip, servingSize === size && styles.servingChipActive]}
                    onPress={() => setServingSize(size)}
                  >
                    <Text style={[styles.servingChipText, servingSize === size && styles.servingChipTextActive]}>
                      {size}人分{size === 2 ? '(標準)' : ''}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.sectionHeader}>📖 材料 ＆ 作り方 ({servingSize}人分)</Text>

              {isCookingModeEnabled && isCookingMode ? (
                recipeLines.map((line, idx) => {
                  const isChecked = !!checkedLines[idx];
                  return (
                    <TouchableOpacity
                      key={idx}
                      activeOpacity={0.7}
                      onPress={() => toggleLineCheck(idx)}
                      style={[styles.recipeLineRow, isChecked && styles.recipeLineRowChecked]}
                    >
                      <Text style={styles.checkIcon}>{isChecked ? '✅' : '⬜'}</Text>
                      <Text
                        style={[
                          styles.cookingLineText,
                          isChecked && styles.checkedLineText,
                        ]}
                      >
                        {line}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <Text style={styles.detailText}>{recipeLines.join('\n')}</Text>
              )}
            </View>
          </ScrollView>
        </Animated.View>
      </SafeAreaView>
    );
  }

  // =============================================================
  // サブ画面：編集画面（シームレスアニメーション付き）
  // =============================================================
  if (activeSubView === 'edit') {
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
                {editingRecipeId ? (isEditingDefault ? '基本レシピの調整' : 'レシピ・味の調整') : 'レシピ登録'}
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
                    <Text style={styles.formCardHeader}>📌 基本情報</Text>

                    <Text style={styles.fieldLabel}>料理名 <Text style={styles.requiredMark}>*</Text></Text>
                    <TextInput
                      style={styles.inputTitle}
                      value={title}
                      onChangeText={setTitle}
                      placeholder="例: 豚の生姜焼き"
                      placeholderTextColor={theme.textMuted}
                    />

                    <Text style={styles.fieldLabel}>📸 完成した料理の写真</Text>
                    {foodImageUri ? (
                      <View style={styles.photoPreviewWrapper}>
                        <Image source={{ uri: foodImageUri }} style={styles.foodPhotoPreview} />
                        <TouchableOpacity style={styles.changePhotoBtn} onPress={pickFoodPhoto}>
                          <Text style={styles.changePhotoBtnText}>写真を変更</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity style={styles.photoSelectBox} onPress={pickFoodPhoto} activeOpacity={0.7}>
                        <Text style={styles.photoSelectIcon}>📷</Text>
                        <Text style={styles.photoSelectText}>写真を設定する（任意）</Text>
                      </TouchableOpacity>
                    )}

                    <Text style={[styles.fieldLabel, { marginTop: 14 }]}>⏱️ 調理時間の目安（分）</Text>
                    <TextInput
                      style={styles.inputRegular}
                      value={String(cookingTime)}
                      onChangeText={(val) => setCookingTime(val.replace(/[^0-9]/g, ''))}
                      placeholder="例: 15"
                      placeholderTextColor={theme.textMuted}
                      keyboardType="number-pad"
                    />

                    <Text style={[styles.fieldLabel, { marginTop: 10 }]}>🏷️ お弁当・作り置きタグ</Text>
                    <View style={styles.tagToggleRow}>
                      <TouchableOpacity
                        style={[styles.tagToggleBtn, isBento && styles.tagToggleBtnActive]}
                        onPress={() => setIsBento(!isBento)}
                      >
                        <Text style={[styles.tagToggleBtnText, isBento && styles.tagToggleBtnTextActive]}>
                          🍱 お弁当向き {isBento ? '✔' : ''}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.tagToggleBtn, isMealPrep && styles.tagToggleBtnActive]}
                        onPress={() => setIsMealPrep(!isMealPrep)}
                      >
                        <Text style={[styles.tagToggleBtnText, isMealPrep && styles.tagToggleBtnTextActive]}>
                          🧊 作り置き向き {isMealPrep ? '✔' : ''}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={[styles.fieldLabel, { marginTop: 12 }]}>🏷️ カテゴリー</Text>
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
                              {cat.icon} {cat.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  <View style={[styles.formCard, styles.formCardHighlight]}>
                    <Text style={[styles.formCardHeader, { color: theme.primary }]}>
                      💡 わが家の味調整 ＆ 家族の評価
                    </Text>

                    <Text style={styles.fieldLabel}>⭐ おいしさの評価（星をつけると定番へ昇格）</Text>
                    <View style={styles.familyRatingContainer}>
                      {members.map((m) => {
                        const currentRating = familyRatings[m.id] ?? 0;
                        return (
                          <View key={m.id} style={styles.familyRatingRow}>
                            <Text style={styles.familyMemberName} numberOfLines={1}>
                              👤 {m.name}
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
                                    {starVal === 0 ? '無し' : '★'.repeat(starVal)}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>
                        );
                      })}
                    </View>

                    <Text style={[styles.fieldLabel, { marginTop: 14 }]}>
                      ✍️ 味の調整・感想メモ
                    </Text>
                    <Text style={styles.subLabelHelp}>
                      「醤油小さじ1多めが黄金比」「少し塩分控えめにする」など残すと次回迷いません
                    </Text>
                    <TextInput
                      style={styles.noteInput}
                      value={notes}
                      onChangeText={setNotes}
                      placeholder="家族の反応や、次回に向けた調味料の微調整..."
                      placeholderTextColor={theme.textMuted}
                      multiline
                      scrollEnabled={false}
                    />
                  </View>

                  <View style={styles.formCard}>
                    <Text style={styles.formCardHeader}>📖 レシピ内容 ＆ 参考リンク</Text>

                    <Text style={styles.fieldLabel}>🌐 参考にしたWebページURL</Text>
                    <TextInput
                      style={styles.inputRegular}
                      value={webUrl}
                      onChangeText={setWebUrl}
                      placeholder="例: https://cookpad.com/... や YouTubeのURL"
                      placeholderTextColor={theme.textMuted}
                      autoCapitalize="none"
                      keyboardType="url"
                    />

                    <Text style={[styles.fieldLabel, { marginTop: 12 }]}>
                      📝 材料 ＆ 作り方
                    </Text>
                    <TextInput
                      style={styles.recipeTextInput}
                      value={extractedText}
                      onChangeText={setExtractedText}
                      placeholder="材料や手順（自由に加筆・修正できます）"
                      placeholderTextColor={theme.textMuted}
                      multiline
                      scrollEnabled={false}
                    />
                  </View>

                  {editingRecipeId ? (
                    isEditingDefault ? (
                      <SpringCard
                        style={styles.resetDefaultBtn}
                        onPress={() => handleResetDefaultRecipe(editingRecipeId)}
                      >
                        <Text style={styles.resetDefaultBtnText}>🔄 この基本レシピを初期状態に戻す</Text>
                      </SpringCard>
                    ) : (
                      <SpringCard
                        style={styles.deleteFormBtn}
                        onPress={() => handleDeletePress(editingRecipeId)}
                      >
                        <Text style={styles.deleteFormBtnText}>🗑️ このレシピを削除する</Text>
                      </SpringCard>
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
  // メイン画面（なめらかなタブ遷移付き）
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
            タブ1：🏠 ホーム画面
        ----------------------------------------------------------- */}
        {currentTab === 'home' && (
          <View style={{ flex: 1 }}>
            <View style={styles.header}>
              <View style={styles.headerSideArea} />
              <Image
                source={require('./assets/logo.png')}
                style={styles.headerLogo}
                resizeMode="contain"
              />
              <View style={styles.headerSideArea} />
            </View>

            <ScrollView style={styles.homeScrollView}>
              {isHeadlineEnabled && currentSeasonalText ? (
                <TouchableOpacity
                  style={styles.headlineBarHome}
                  activeOpacity={0.8}
                  onPress={() => switchTabSmoothly('recipes')}
                >
                  <Text style={styles.headlineTextHome}>
                    {currentSeasonIcon} {currentMonth}月の旬食材: {currentSeasonalText}
                  </Text>
                </TouchableOpacity>
              ) : null}

              {/* ① 今夜のリクエスト */}
              <View style={styles.homeSectionHeader}>
                <Text style={styles.homeSectionTitle}>🙋 今夜のリクエスト</Text>
              </View>
              {isRequestEnabled && requestedCount > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                  {allRecipes
                    .filter((r) => r.isRequested)
                    .map((item) => (
                      <SpringCard
                        key={item.id}
                        style={[styles.horizontalCard, { borderColor: '#E8A86B', backgroundColor: theme.isDark ? '#261F1A' : '#FFFDF9' }]}
                        onPress={() => {
                          setSelectedRecipe(item);
                          setIsCookingMode(false);
                          openSubViewSmoothly('detail');
                        }}
                      >
                        {item.foodImageUri || item.imageUri ? (
                          <Image source={{ uri: item.foodImageUri || item.imageUri }} style={styles.horizontalThumb} />
                        ) : (
                          <View style={[styles.horizontalThumb, styles.horizontalThumbPlaceholder]}>
                            <Text style={{ fontSize: 24 }}>🍽️</Text>
                          </View>
                        )}
                        <View style={styles.horizontalCardBody}>
                          <Text style={styles.horizontalCardTitle} numberOfLines={1}>{item.title}</Text>
                          <Text style={{ fontSize: 11, color: '#C85A17', fontWeight: 'bold' }}>🙋 リクエスト中</Text>
                        </View>
                      </SpringCard>
                    ))}
                </ScrollView>
              ) : (
                <View style={styles.homeEmptyCard}>
                  <Text style={styles.homeEmptyCardTitle}>🙋 本日のリクエストはありません</Text>
                  <Text style={styles.homeEmptyCardSub}>
                    家族に「今日何食べたい？」と聞いてみませんか？{`\n`}
                    各レシピの「今日これ食べたい！」を押すとここに並びます。
                  </Text>
                </View>
              )}

              {/* ② 今日のオススメ（ごぶさたスタメン） */}
              <View style={styles.homeSectionHeader}>
                <Text style={styles.homeSectionTitle}>💡 今日のオススメ（ごぶさたスタメン）</Text>
              </View>
              {recommendedStapleRecipe ? (
                <SpringCard
                  style={styles.homeRecommendCard}
                  onPress={() => {
                    setSelectedRecipe(recommendedStapleRecipe);
                    setIsCookingMode(false);
                    openSubViewSmoothly('detail');
                  }}
                >
                  <View style={styles.homeRecommendLeft}>
                    <Text style={styles.homeRecommendTag}>⭐ わが家の殿堂入り</Text>
                    <Text style={styles.homeRecommendTitle} numberOfLines={1}>
                      {getCategoryIcon(recommendedStapleRecipe.category)} {recommendedStapleRecipe.title}
                    </Text>
                    <Text style={styles.homeRecommendSub}>
                      {recommendedStapleRecipe.lastCookedAt
                        ? `前回: ${formatRelativeDate(recommendedStapleRecipe.lastCookedAt)}に調理`
                        : '最近作っていない鉄板メニューです'}
                    </Text>
                  </View>
                  <View style={styles.homeRecommendBtn}>
                    <Text style={styles.homeRecommendBtnText}>決定 ›</Text>
                  </View>
                </SpringCard>
              ) : (
                <View style={styles.homeEmptyCard}>
                  <Text style={styles.homeEmptyCardTitle}>💡 オススメレシピの準備中</Text>
                  <Text style={styles.homeEmptyCardSub}>
                    レシピに「★★★」の評価をつけていくと、最近作っていないおすすめ料理がここに自動提案されます。
                  </Text>
                </View>
              )}

              {/* ③ 直近の献立（被り防止） */}
              <View style={styles.homeSectionHeader}>
                <Text style={styles.homeSectionTitle}>🕒 直近の献立（被り防止）</Text>
              </View>
              {isCookedButtonEnabled && recentCookedRecipes.length > 0 ? (
                <View style={styles.recentMealCard}>
                  {recentCookedRecipes.map((r) => (
                    <TouchableOpacity
                      key={r.id}
                      style={styles.recentMealRow}
                      activeOpacity={0.7}
                      onPress={() => {
                        setSelectedRecipe(r);
                        setIsCookingMode(false);
                        openSubViewSmoothly('detail');
                      }}
                    >
                      <Text style={styles.recentMealDate}>{formatRelativeDate(r.lastCookedAt)}</Text>
                      <Text style={styles.recentMealTitle} numberOfLines={1}>
                        {getCategoryIcon(r.category)} {r.title}
                      </Text>
                      <Text style={{ fontSize: 11, color: theme.textMuted }}>詳細 ›</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={styles.homeEmptyCard}>
                  <Text style={styles.homeEmptyCardTitle}>🕒 調理履歴はまだありません</Text>
                  <Text style={styles.homeEmptyCardSub}>
                    料理を作った後に「調理終了」を押すと、ここに履歴が自動記録され、毎日の献立の被り防止に役立ちます。
                  </Text>
                </View>
              )}

              {/* ④ 🌱 週末の挑戦（未調理カルーセル） */}
              <View style={[styles.homeSectionHeader, { marginTop: 16 }]}>
                <Text style={styles.homeSectionTitle}>🌱 週末の挑戦（作ってみたい）</Text>
              </View>
              {wantToCookRecipes.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  {wantToCookRecipes.map((item) => (
                    <SpringCard
                      key={item.id}
                      style={styles.horizontalCard}
                      onPress={() => {
                        setSelectedRecipe(item);
                        setIsCookingMode(false);
                        openSubViewSmoothly('detail');
                      }}
                    >
                      {item.foodImageUri || item.imageUri ? (
                        <Image source={{ uri: item.foodImageUri || item.imageUri }} style={styles.horizontalThumb} />
                      ) : (
                        <View style={[styles.horizontalThumb, styles.horizontalThumbPlaceholder]}>
                          <Text style={{ fontSize: 24 }}>🌱</Text>
                        </View>
                      )}
                      <View style={styles.horizontalCardBody}>
                        <Text style={styles.horizontalCardTitle} numberOfLines={1}>{item.title}</Text>
                        <View style={styles.horizontalCardMeta}>
                          <Text style={{ fontSize: 10.5, color: theme.accentSage, fontWeight: 'bold' }}>🌱 未調理</Text>
                          {item.cookingTime ? <Text style={{ fontSize: 10.5, color: theme.textMuted }}>⏱️{item.cookingTime}分</Text> : null}
                        </View>
                      </View>
                    </SpringCard>
                  ))}
                </ScrollView>
              ) : (
                <View style={styles.homeEmptyCard}>
                  <Text style={styles.homeEmptyCardTitle}>🌱 作ってみたいレシピはありません</Text>
                  <Text style={styles.homeEmptyCardSub}>
                    SNSや本で見つけた気になる料理を「レシピ帳」の「＋追加」からスクショ保存してみましょう！休日の挑戦枠に並びます。
                  </Text>
                </View>
              )}

              {/* ⑤ ⭐ わが家の殿堂入り */}
              {topStarredRecipes.length > 0 ? (
                <>
                  <View style={styles.homeSectionHeader}>
                    <Text style={styles.homeSectionTitle}>⭐ わが家の殿堂入り（★★★）</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
                    {topStarredRecipes.map((item) => (
                      <SpringCard
                        key={item.id}
                        style={styles.horizontalCard}
                        onPress={() => {
                          setSelectedRecipe(item);
                          setIsCookingMode(false);
                          openSubViewSmoothly('detail');
                        }}
                      >
                        {item.foodImageUri || item.imageUri ? (
                          <Image source={{ uri: item.foodImageUri || item.imageUri }} style={styles.horizontalThumb} />
                        ) : (
                          <View style={[styles.horizontalThumb, styles.horizontalThumbPlaceholder]}>
                            <Text style={{ fontSize: 24 }}>🍽️</Text>
                          </View>
                        )}
                        <View style={styles.horizontalCardBody}>
                          <Text style={styles.horizontalCardTitle} numberOfLines={1}>{item.title}</Text>
                          <Text style={{ fontSize: 10.5, color: '#C85A17', fontWeight: 'bold' }}>★★★ リピート確定</Text>
                        </View>
                      </SpringCard>
                    ))}
                  </ScrollView>
                </>
              ) : null}
            </ScrollView>
          </View>
        )}

        {/* -----------------------------------------------------------
            タブ2：📖 レシピ帳画面
        ----------------------------------------------------------- */}
        {currentTab === 'recipes' && (
          <View style={{ flex: 1 }}>
            <View style={styles.header}>
              <View style={styles.headerSideArea} />
              <Text style={styles.headerTitle}>📖 レシピ帳</Text>
              <View style={styles.headerSideArea} />
            </View>

            <View style={styles.searchBarContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="料理名・食材・メモで検索..."
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
                    🏠 登録レシピ ({userRecipeCount})
                  </Text>
                </TouchableOpacity>

                {isRequestEnabled ? (
                  <TouchableOpacity
                    style={[styles.filterTab, filterMode === 'requested' && styles.filterTabActiveRequested]}
                    onPress={() => setFilterMode('requested')}
                  >
                    <Text style={[styles.filterTabText, filterMode === 'requested' && styles.filterTabTextActiveRequested]}>
                      🙋 食べたい！ ({requestedCount})
                    </Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  style={[styles.filterTab, filterMode === 'wantToCook' && styles.filterTabActiveWant]}
                  onPress={() => setFilterMode('wantToCook')}
                >
                  <Text style={[styles.filterTabText, filterMode === 'wantToCook' && styles.filterTabTextActiveWant]}>
                    🌱 作ってみたい ({wantToCookCount})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.filterTab, filterMode === 'bento' && styles.filterTabActiveBento]}
                  onPress={() => setFilterMode('bento')}
                >
                  <Text style={[styles.filterTabText, filterMode === 'bento' && styles.filterTabTextActive]}>
                    🍱 お弁当
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.filterTab, filterMode === 'mealPrep' && styles.filterTabActiveMealPrep]}
                  onPress={() => setFilterMode('mealPrep')}
                >
                  <Text style={[styles.filterTabText, filterMode === 'mealPrep' && styles.filterTabTextActive]}>
                    🧊 作り置き
                  </Text>
                </TouchableOpacity>

                {isShowDefaultRecipes ? (
                  <TouchableOpacity
                    style={[styles.filterTab, filterMode === 'preset' && styles.filterTabActivePreset]}
                    onPress={() => setFilterMode('preset')}
                  >
                    <Text style={[styles.filterTabText, filterMode === 'preset' && styles.filterTabTextActivePreset]}>
                      📖 基本レシピ
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
                const displayImage = item.foodImageUri || item.imageUri;
                const categoryIcon = getCategoryIcon(item.category);

                return (
                  <SpringCard
                    style={[styles.card, isRequestEnabled && item.isRequested && styles.cardRequestedHighlight]}
                    onPress={() => {
                      setSelectedRecipe(item);
                      setIsCookingMode(false);
                      setCheckedLines({});
                      openSubViewSmoothly('detail');
                    }}
                  >
                    {displayImage ? (
                      <Image source={{ uri: displayImage }} style={styles.thumbnail} />
                    ) : (
                      <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
                        <Text style={{ fontSize: 24 }}>{categoryIcon}</Text>
                      </View>
                    )}
                    <View style={styles.cardBody}>
                      <View style={styles.cardHeaderRow}>
                        <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                        {item.category ? (
                          <View style={styles.cardBadgeItem}>
                            <Text style={styles.cardBadgeItemText}>{categoryIcon} {item.category}</Text>
                          </View>
                        ) : null}
                      </View>

                      <View style={styles.cardBadgesRow}>
                        {item.cookingTime ? (
                          <View style={styles.cardBadgeItem}>
                            <Text style={styles.cardBadgeItemText}>⏱️ {item.cookingTime}分</Text>
                          </View>
                        ) : null}
                        {item.isBento ? (
                          <View style={[styles.cardBadgeItem, { backgroundColor: '#FDF2E9' }]}>
                            <Text style={[styles.cardBadgeItemText, { color: '#C85A17' }]}>🍱 弁当</Text>
                          </View>
                        ) : null}
                        {item.isMealPrep ? (
                          <View style={[styles.cardBadgeItem, { backgroundColor: '#EBF5FB' }]}>
                            <Text style={[styles.cardBadgeItemText, { color: '#3A7CA5' }]}>🧊 置</Text>
                          </View>
                        ) : null}
                      </View>

                      {item.notes ? (
                        <Text style={styles.cardNotes} numberOfLines={1}>💡 {item.notes}</Text>
                      ) : (
                        <Text style={styles.cardNotesEmpty}>メモ未入力</Text>
                      )}

                      <View style={styles.cardMetaRow}>
                        <Text style={styles.cardDate}>
                          {item.isDefault ? '📖 基本レシピ' : item.updatedAt ? `更新: ${item.updatedAt}` : `登録: ${item.createdAt}`}
                        </Text>
                      </View>
                    </View>
                  </SpringCard>
                );
              }}
            />

            <SpringCard style={styles.fab} onPress={pickRecipeImage}>
              <Text style={styles.fabText}>＋ レシピ追加</Text>
            </SpringCard>
          </View>
        )}

        {/* -----------------------------------------------------------
            タブ3：🛒 買い物リスト画面
        ----------------------------------------------------------- */}
        {currentTab === 'shopping' && (
          <View style={{ flex: 1 }}>
            <View style={styles.header}>
              <View style={styles.headerSideArea} />
              <Text style={styles.headerTitle}>🛒 買い物リスト</Text>
              <View style={[styles.headerSideArea, { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'flex-end', gap: 10, width: 140 }]}>
                {shoppingList.some((i) => i.checked) ? (
                  <TouchableOpacity onPress={handleClearBoughtItems}>
                    <Text style={styles.clearBoughtText}>購入済クリア</Text>
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
                placeholder="＋ 食材や日用品を直接追加..."
                placeholderTextColor={theme.textMuted}
                onSubmitEditing={handleAddManualShoppingItem}
              />
              <TouchableOpacity style={styles.addShoppingBtn} onPress={handleAddManualShoppingItem}>
                <Text style={styles.addShoppingBtnText}>追加</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 90 }}>
              {shoppingList.length === 0 ? (
                <View style={styles.homeEmptyCard}>
                  <Text style={styles.homeEmptyCardTitle}>🛒 買い物リストは空です</Text>
                  <Text style={styles.homeEmptyCardSub}>
                    レシピ詳細画面の「🛒 買い物追加」ボタンを押すと、生鮮食材が自動で売り場順に集まります。
                  </Text>
                </View>
              ) : (
                SHOPPING_AISLES.map((aisle) => {
                  const aisleItems = shoppingList.filter((item) => item.aisle === aisle.key);
                  if (aisleItems.length === 0) return null;

                  return (
                    <View key={aisle.key} style={styles.formCard}>
                      <Text style={styles.formCardHeaderNoBorder}>{aisle.label}</Text>
                      <View style={{ marginTop: 8 }}>
                        {aisleItems.map((item) => (
                          <View
                            key={item.id}
                            style={[styles.shoppingItemRow, item.checked && styles.shoppingItemRowChecked]}
                          >
                            <TouchableOpacity
                              style={styles.shoppingItemCheckArea}
                              onPress={() => handleToggleShoppingItem(item.id)}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.shoppingCheckIcon}>{item.checked ? '✅' : '⬜'}</Text>
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
                              <Text style={styles.shoppingItemDeleteText}>✕</Text>
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
            タブ4：⚙️ 設定画面
        ----------------------------------------------------------- */}
        {currentTab === 'settings' && (
          <View style={{ flex: 1 }}>
            <View style={styles.header}>
              <View style={styles.headerSideArea} />
              <Text style={styles.headerTitle}>⚙️ アプリの設定</Text>
              <View style={styles.headerSideArea} />
            </View>

            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 90 }}>
              <View style={[styles.formCard, styles.formCardHighlight]}>
                <Text style={[styles.formCardHeader, { color: theme.primary }]}>
                  🏠 家族グループ（データの共有・個別化）
                </Text>
                <Text style={styles.subLabelHelp}>
                  同じ家族IDを使うスマホ同士でのみレシピが同期されます。高セキュリティな1兆通り以上のIDで他世帯と完全に分離されます。
                </Text>

                <Text style={styles.fieldLabel}>あなたの家族ID</Text>
                <View style={styles.familyIdDisplayBox}>
                  <Text style={styles.familyIdText} selectable={true}>{familyId || '発行中...'}</Text>
                  <TouchableOpacity
                    style={styles.familyIdInfoBtn}
                    onPress={() => {
                      const msg = `あなたの家族ID: ${familyId}\n\nこのIDをパートナーや家族のスマホの「別の家族グループに参加」欄に入力すると、同じレシピ帳をリアルタイム共有できます。`;
                      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('家族グループID', msg);
                    }}
                  >
                    <Text style={styles.familyIdInfoBtnText}>共有方法</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.regenerateIdBtn}
                  onPress={handleRegenerateFamilyId}
                  activeOpacity={0.7}
                >
                  <Text style={styles.regenerateIdBtnText}>🔄 新しい家族IDを再発行する</Text>
                </TouchableOpacity>

                <Text style={[styles.fieldLabel, { marginTop: 14 }]}>別の家族グループに参加する</Text>
                <View style={styles.joinFamilyRow}>
                  <TextInput
                    style={styles.joinFamilyInput}
                    value={joinFamilyInput}
                    onChangeText={setJoinFamilyInput}
                    placeholder="家族IDを入力 (例: FAM-XXXX-XXXX)"
                    placeholderTextColor={theme.textMuted}
                    autoCapitalize="characters"
                  />
                  <TouchableOpacity style={styles.joinFamilyBtn} onPress={handleJoinFamily}>
                    <Text style={styles.joinFamilyBtnText}>参加</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.formCard}>
                <Text style={styles.formCardHeader}>🎨 画面のテーマ</Text>
                <View style={styles.settingToggleRow}>
                  <TouchableOpacity
                    style={[styles.settingOptionBtn, !isDarkMode && styles.settingOptionBtnActive]}
                    onPress={() => updateSetting('@setting_dark_mode', false, setIsDarkMode)}
                  >
                    <Text style={[styles.settingOptionText, !isDarkMode && styles.settingOptionTextActive]}>
                      ☀️ ライトモード
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.settingOptionBtn, isDarkMode && styles.settingOptionBtnActive]}
                    onPress={() => updateSetting('@setting_dark_mode', true, setIsDarkMode)}
                  >
                    <Text style={[styles.settingOptionText, isDarkMode && styles.settingOptionTextActive]}>
                      🌙 ダークモード
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.formCard}>
                <View style={styles.memberHeaderRow}>
                  <Text style={styles.formCardHeaderNoBorder}>👥 評価メンバーの管理</Text>
                  <Text style={styles.memberCountBadge}>{members.length} / 5 人</Text>
                </View>
                <Text style={styles.subLabelHelp}>
                  料理を評価するメンバーの名前を変更したり、家族を追加・削除できます（最大5人）。
                </Text>

                {members.map((m, idx) => (
                  <View key={m.id} style={styles.memberEditRow}>
                    <Text style={styles.memberIndexLabel}>#{idx + 1}</Text>
                    <TextInput
                      style={styles.memberNameInput}
                      value={m.name}
                      onChangeText={(newName) => handleUpdateMemberName(m.id, newName)}
                      placeholder="メンバー名（例: パパ、長男など）"
                      placeholderTextColor={theme.textMuted}
                    />
                    {members.length > 1 ? (
                      <TouchableOpacity
                        style={styles.memberDeleteBtn}
                        onPress={() => handleDeleteMember(m.id)}
                      >
                        <Text style={styles.memberDeleteBtnText}>✕</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))}

                {members.length < 5 ? (
                  <TouchableOpacity
                    style={styles.addMemberBtn}
                    onPress={handleAddMember}
                  >
                    <Text style={styles.addMemberBtnText}>＋ メンバーを追加する</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <View style={styles.formCard}>
                <Text style={styles.formCardHeader}>⚙️ 家事・キッチン便利機能のON/OFF</Text>

                <Text style={styles.fieldLabel}>🧂 買い物追加時に「基本調味料」を除外する</Text>
                <Text style={styles.subLabelHelp}>
                  ONにすると、醤油・みりん・酒・砂糖・油・塩などの常備調味料を買い物リストから自動除外します。
                </Text>
                <View style={[styles.settingToggleRow, { marginBottom: 14 }]}>
                  <TouchableOpacity
                    style={[styles.settingOptionBtn, isExcludeStapleSeasonings && styles.settingOptionBtnActive]}
                    onPress={() => updateSetting('@setting_exclude_staple_seasonings', true, setIsExcludeStapleSeasonings)}
                  >
                    <Text style={[styles.settingOptionText, isExcludeStapleSeasonings && styles.settingOptionTextActive]}>
                      除外する (推奨)
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.settingOptionBtn, !isExcludeStapleSeasonings && styles.settingOptionBtnActive]}
                    onPress={() => updateSetting('@setting_exclude_staple_seasonings', false, setIsExcludeStapleSeasonings)}
                  >
                    <Text style={[styles.settingOptionText, !isExcludeStapleSeasonings && styles.settingOptionTextActive]}>
                      すべて追加
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.fieldLabel}>🍁 旬食材ヘッドライン</Text>
                <View style={[styles.settingToggleRow, { marginBottom: 14 }]}>
                  <TouchableOpacity
                    style={[styles.settingOptionBtn, isHeadlineEnabled && styles.settingOptionBtnActive]}
                    onPress={() => updateSetting('@setting_headline_enabled', true, setIsHeadlineEnabled)}
                  >
                    <Text style={[styles.settingOptionText, isHeadlineEnabled && styles.settingOptionTextActive]}>表示</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.settingOptionBtn, !isHeadlineEnabled && styles.settingOptionBtnActive]}
                    onPress={() => updateSetting('@setting_headline_enabled', false, setIsHeadlineEnabled)}
                  >
                    <Text style={[styles.settingOptionText, !isHeadlineEnabled && styles.settingOptionTextActive]}>非表示</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.fieldLabel}>📖 基本レシピ10品の表示</Text>
                <View style={[styles.settingToggleRow, { marginBottom: 14 }]}>
                  <TouchableOpacity
                    style={[styles.settingOptionBtn, isShowDefaultRecipes && styles.settingOptionBtnActive]}
                    onPress={() => updateSetting('@setting_show_default_recipes', true, setIsShowDefaultRecipes)}
                  >
                    <Text style={[styles.settingOptionText, isShowDefaultRecipes && styles.settingOptionTextActive]}>表示</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.settingOptionBtn, !isShowDefaultRecipes && styles.settingOptionBtnActive]}
                    onPress={() => updateSetting('@setting_show_default_recipes', false, setIsShowDefaultRecipes)}
                  >
                    <Text style={[styles.settingOptionText, !isShowDefaultRecipes && styles.settingOptionTextActive]}>非表示</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.fieldLabel}>🍳 調理モード（スリープ防止 ＆ チェック）</Text>
                <View style={[styles.settingToggleRow, { marginBottom: 14 }]}>
                  <TouchableOpacity
                    style={[styles.settingOptionBtn, isCookingModeEnabled && styles.settingOptionBtnActive]}
                    onPress={() => updateSetting('@setting_cooking_mode_enabled', true, setIsCookingModeEnabled)}
                  >
                    <Text style={[styles.settingOptionText, isCookingModeEnabled && styles.settingOptionTextActive]}>有効</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.settingOptionBtn, !isCookingModeEnabled && styles.settingOptionBtnActive]}
                    onPress={() => updateSetting('@setting_cooking_mode_enabled', false, setIsCookingModeEnabled)}
                  >
                    <Text style={[styles.settingOptionText, !isCookingModeEnabled && styles.settingOptionTextActive]}>無効</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.fieldLabel}>🙋 「これ食べたい！」リクエスト機能</Text>
                <View style={styles.settingToggleRow}>
                  <TouchableOpacity
                    style={[styles.settingOptionBtn, isRequestEnabled && styles.settingOptionBtnActive]}
                    onPress={() => updateSetting('@setting_request_enabled', true, setIsRequestEnabled)}
                  >
                    <Text style={[styles.settingOptionText, isRequestEnabled && styles.settingOptionTextActive]}>有効</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.settingOptionBtn, !isRequestEnabled && styles.settingOptionBtnActive]}
                    onPress={() => updateSetting('@setting_request_enabled', false, setIsRequestEnabled)}
                  >
                    <Text style={[styles.settingOptionText, !isRequestEnabled && styles.settingOptionTextActive]}>無効</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        )}
      </Animated.View>

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
