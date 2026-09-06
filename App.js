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
} from './helpers';

import { getStyles } from './styles';

// =============================================================
// ★ タッチ時にじわっとフェードアウトするナビボタンコンポーネント
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
    outputRange: ['rgba(211, 84, 0, 0)', 'rgba(211, 84, 0, 0.25)'],
  });

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      style={{ flex: 1 }}
    >
      <Animated.View style={[styles.navTabItem, { backgroundColor, borderRadius: 16 }]}>
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

// =============================================================
// メインアプリケーション
// =============================================================
export default function App() {
  const [cloudRecipes, setCloudRecipes] = useState([]);
  const [currentTab, setCurrentTab] = useState('home');
  const [activeSubView, setActiveSubView] = useState(null); // null | 'detail' | 'edit'

  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // 家族グループID
  const [familyId, setFamilyId] = useState('');
  const [joinFamilyInput, setJoinFamilyInput] = useState('');

  // 設定ステート
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isRequestEnabled, setIsRequestEnabled] = useState(true);
  const [isCookingModeEnabled, setIsCookingModeEnabled] = useState(true);
  const [isHeadlineEnabled, setIsHeadlineEnabled] = useState(true);
  const [isShowDefaultRecipes, setIsShowDefaultRecipes] = useState(true);
  const [isCookedButtonEnabled, setIsCookedButtonEnabled] = useState(true);
  const [members, setMembers] = useState(DEFAULT_MEMBERS);

  // 起動画面用ステート
  const [isAppReady, setIsAppReady] = useState(false);

  // 買い物リストステート
  const [shoppingList, setShoppingList] = useState([]);
  const [manualItemInput, setManualItemInput] = useState('');

  // フィルター
  const [filterMode, setFilterMode] = useState('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 編集用ステート
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
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  // 調理モード用ステート
  const [isCookingMode, setIsCookingMode] = useState(false);
  const [checkedLines, setCheckedLines] = useState({});

  const theme = isDarkMode ? THEMES.dark : THEMES.light;
  const styles = useMemo(() => getStyles(theme), [theme]);

  const currentMonth = new Date().getMonth() + 1;
  const currentSeasonIcon = getSeasonIcon(currentMonth);
  const [selectedSeasonalMonth, setSelectedSeasonalMonth] = useState(currentMonth);
  const currentSeasonalText = MONTHLY_SEASONAL_MAP[currentMonth] || '';

  const firestoreFamilyApiUrl = useMemo(() => {
    if (!FIREBASE_PROJECT_ID || !familyId) return null;
    return `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/families/${familyId}/recipes`;
  }, [familyId]);

  // クラウドと基本レシピ10品のマージ
  const allRecipes = useMemo(() => {
    if (!isShowDefaultRecipes) {
      return cloudRecipes.filter((r) => !r.isDefault);
    }
    const presetMap = new Map();
    PRESET_DEFAULT_RECIPES.forEach((p) => presetMap.set(p.id, p));
    cloudRecipes.forEach((r) => presetMap.set(r.id, r));
    return Array.from(presetMap.values());
  }, [cloudRecipes, isShowDefaultRecipes]);

  useEffect(() => {
    // 起動スプラッシュ画面のタイマー
    const timer = setTimeout(() => {
      setIsAppReady(true);
    }, 1200);

    // 中華フォント対策（ブラウザに日本語を明示）
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
    const interval = setInterval(fetchRecipesFromCloud, 12000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firestoreFamilyApiUrl]);

  const updateSetting = async (key, value, setter) => {
    setter(value);
    try {
      await AsyncStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    } catch (e) {
      console.error(e);
    }
  };

  const saveShoppingList = async (newList) => {
    setShoppingList(newList);
    try {
      await AsyncStorage.setItem('@shopping_list', JSON.stringify(newList));
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddRecipeToShoppingList = (recipe) => {
    const extracted = extractIngredientsFromRecipeText(recipe.extractedText);
    if (extracted.length === 0) {
      const msg = 'レシピから材料が見つかりませんでした。';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('案内', msg);
      return;
    }
    const updated = [...shoppingList, ...extracted];
    saveShoppingList(updated);
    const successMsg = `「${recipe.title}」の材料（${extracted.length}品）を買い物リストに追加しました！`;
    Platform.OS === 'web' ? window.alert(successMsg) : Alert.alert('追加完了', successMsg);
  };

  const handleClearAllShoppingList = () => {
    if (shoppingList.length === 0) return;
    const msg = '買い物リストの全アイテムを消去しますか？';
    const execute = () => saveShoppingList([]);

    if (Platform.OS === 'web') {
      if (window.confirm(msg)) execute();
    } else {
      Alert.alert('リスト全消去', msg, [
        { text: 'キャンセル', style: 'cancel' },
        { text: '全消去', style: 'destructive', onPress: execute },
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

  // ★ 今日作った！処理（未調理なら評価・味メモ画面へ直接ジャンプ）
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
          if (window.confirm('初調理おめでとうございます！🎉\n家族の評価や味メモを記録しますか？')) {
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

    if (input && !input.startsWith('FAM-')) {
      input = 'FAM-' + input;
    }

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
      setCurrentTab('recipes');
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
    setCheckedLines((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
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

  const filteredRecipes = useMemo(() => {
    let result = [...allRecipes];

    if (isRequestEnabled && filterMode === 'requested') {
      result = result.filter((r) => r.isRequested);
    } else if (filterMode === 'wantToCook') {
      result = result.filter((r) => !r.isCooked);
    } else if (filterMode === 'userOnly') {
      result = result.filter((r) => !r.isDefault);
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
      const defaultRatings = {};
      members.forEach((m) => {
        defaultRatings[m.id] = 0;
      });
      setFamilyRatings(defaultRatings);
      setActiveSubView('edit');

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
      setActiveSubView(null);
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
    setImageUri(recipe.imageUri || null);
    setFoodImageUri(recipe.foodImageUri || null);
    setWebUrl(recipe.webUrl || '');
    setActiveSubView('edit');
  };

  const handleResetDefaultRecipe = (recipeId) => {
    if (!firestoreFamilyApiUrl) return;

    const executeReset = async () => {
      try {
        await fetch(`${firestoreFamilyApiUrl}/${recipeId}`, { method: 'DELETE' });
        await fetchRecipesFromCloud();
        resetForm();
        setSelectedRecipe(null);
        setActiveSubView(null);
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
        setActiveSubView(null);
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

  // =============================================================
  // 起動時のスプラッシュ画面
  // =============================================================
  if (!isAppReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F8EBD8', justifyContent: 'center', alignItems: 'center' }}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8EBD8" />
        <Image
          source={require('./assets/logo.png')}
          style={{ width: 180, height: 60, marginBottom: 12 }}
          resizeMode="contain"
        />
        <Text style={{ fontSize: 13, color: '#5D4037', fontWeight: 'bold', letterSpacing: 2 }}>
          わが家のレシピ帳
        </Text>
      </View>
    );
  }

  // =============================================================
  // サブ画面：詳細画面
  // =============================================================
  if (activeSubView === 'detail' && selectedRecipe) {
    const mainImage = selectedRecipe.foodImageUri || selectedRecipe.imageUri;
    const categoryIcon = getCategoryIcon(selectedRecipe.category);

    const rawLines = (selectedRecipe.extractedText || '')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    const recipeLines =
      rawLines.length > 0 && rawLines[0].replace(/[#*]/g, '').trim() === selectedRecipe.title.trim()
        ? rawLines.slice(1)
        : rawLines;

    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle={theme.statusBar} backgroundColor={theme.headerBg} />
        
        <View style={styles.header}>
          <View style={styles.headerSideArea}>
            <TouchableOpacity onPress={() => setActiveSubView(null)}>
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
            {selectedRecipe.category ? (
              <View style={styles.detailCategoryBadge}>
                <Text style={styles.detailCategoryBadgeText}>
                  {categoryIcon} {selectedRecipe.category}
                </Text>
              </View>
            ) : null}
          </View>

          {!selectedRecipe.isCooked ? (
            <View style={styles.detailUncookedBox}>
              <Text style={styles.detailUncookedText}>🌱 まだ作っていません（食べた後に「編集」から評価して定番へ！）</Text>
            </View>
          ) : (
            <View style={styles.detailFamilyRatingContainer}>
              {members.map((m) => {
                const rateVal = selectedRecipe.familyRatings?.[m.id];
                if (rateVal === undefined) return null;
                return (
                  <View key={m.id} style={styles.detailFamilyRatingChip}>
                    <Text style={styles.detailFamilyMemberLabel}>{m.name}</Text>
                    <Text style={styles.detailFamilyMemberStars}>
                      {RATING_STARS[rateVal] || '☆☆☆'}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {isCookedButtonEnabled ? (
            <TouchableOpacity
              style={styles.todayCookedBtn}
              onPress={() => handleMarkAsCookedToday(selectedRecipe)}
              activeOpacity={0.8}
            >
              <Text style={styles.todayCookedBtnText}>🍳 今日この料理を作った！</Text>
            </TouchableOpacity>
          ) : null}

          <View style={styles.smartActionBar}>
            {isCookingModeEnabled ? (
              <TouchableOpacity
                style={[styles.smartActionBtn, isCookingMode && styles.smartActionBtnActiveCooking]}
                onPress={toggleCookingMode}
                activeOpacity={0.7}
              >
                <Text style={[styles.smartActionBtnText, isCookingMode && styles.smartActionBtnTextActive]}>
                  {isCookingMode ? '🍳 調理終了' : '🍳 調理モード'}
                </Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={styles.smartActionBtn}
              onPress={() => handleAddRecipeToShoppingList(selectedRecipe)}
              activeOpacity={0.7}
            >
              <Text style={styles.smartActionBtnText}>🛒 買い物追加</Text>
            </TouchableOpacity>

            {isRequestEnabled ? (
              <TouchableOpacity
                style={[styles.smartActionBtn, selectedRecipe.isRequested && styles.smartActionBtnActiveRequest]}
                onPress={() => handleToggleRequest(selectedRecipe)}
                activeOpacity={0.7}
              >
                <Text style={[styles.smartActionBtnText, selectedRecipe.isRequested && styles.smartActionBtnTextActive]}>
                  {selectedRecipe.isRequested ? '😋 食べたい中' : '🙋 食べたい！'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {isCookingMode ? (
            <View style={styles.cookingActiveBanner}>
              <Text style={styles.cookingActiveBannerText}>🍳 調理モード中：タップで調味料や工程を消し込みできます</Text>
            </View>
          ) : null}

          {selectedRecipe.webUrl ? (
            <TouchableOpacity
              style={styles.webLinkButton}
              onPress={() => handleOpenWebPage(selectedRecipe.webUrl)}
            >
              <Text style={styles.webLinkButtonText}>🌐 参考にしたWebページを開く ↗</Text>
            </TouchableOpacity>
          ) : null}

          {selectedRecipe.notes ? (
            <View style={styles.noteSection}>
              <Text style={styles.noteSectionHeader}>💡 わが家の味調整・メモ</Text>
              <Text style={styles.noteText}>{selectedRecipe.notes}</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.noteSectionEmpty}
              onPress={() => handleEditPress(selectedRecipe)}
              activeOpacity={0.7}
            >
              <Text style={styles.noteTextEmpty}>💡 ＋ 味の調整や家族の感想をメモする</Text>
            </TouchableOpacity>
          )}

          <View style={styles.detailSection}>
            <Text style={styles.sectionHeader}>📖 レシピ内容</Text>

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
      </SafeAreaView>
    );
  }

  // =============================================================
  // サブ画面：編集画面
  // =============================================================
  if (activeSubView === 'edit') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle={theme.statusBar} backgroundColor={theme.headerBg} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View style={styles.header}>
            <View style={styles.headerSideArea}>
              <TouchableOpacity
                onPress={() => {
                  resetForm();
                  setActiveSubView(null);
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

                  <Text style={[styles.fieldLabel, { marginTop: 14 }]}>🏷️ カテゴリー</Text>
                  <View style={styles.categorySelectorRow}>
                    {CATEGORIES.map((cat) => {
                      const isSelected = category === cat.key;
                      return (
                        <TouchableOpacity
                          key={cat.key}
                          style={[styles.categoryChip, isSelected && styles.categoryChipSelected]}
                          onPress={() => setCategory(cat.key)}
                          activeOpacity={0.7}
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
                      const currentRating = familyRatings[m.id];
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
                                  setIsCookedState(true);
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
                    <TouchableOpacity
                      style={styles.resetDefaultBtn}
                      onPress={() => handleResetDefaultRecipe(editingRecipeId)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.resetDefaultBtnText}>🔄 この基本レシピを初期状態に戻す</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.deleteFormBtn}
                      onPress={() => handleDeletePress(editingRecipeId)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.deleteFormBtnText}>🗑️ このレシピを削除する</Text>
                    </TouchableOpacity>
                  )
                ) : null}
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // =============================================================
  // メイン画面（下部5タブ切り替え）
  // =============================================================
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={theme.statusBar} backgroundColor={theme.headerBg} />

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
            {/* 検索 ＆ クイックレシピ追加 */}
            <View style={styles.homeSearchRow}>
              <TextInput
                style={styles.homeSearchInput}
                placeholder="食べたい料理や食材で探す..."
                placeholderTextColor={theme.textMuted}
                value={searchQuery}
                onChangeText={(q) => {
                  setSearchQuery(q);
                  if (q.trim()) setCurrentTab('recipes');
                }}
              />
              <TouchableOpacity style={styles.homeAddBtn} onPress={pickRecipeImage}>
                <Text style={styles.homeAddBtnText}>＋ 追加</Text>
              </TouchableOpacity>
            </View>

            {/* 旬食材ヘッドライン */}
            {isHeadlineEnabled && currentSeasonalText ? (
              <View style={styles.headlineBarHome}>
                <Text style={styles.headlineTextHome}>
                  {currentSeasonIcon} {currentMonth}月の旬: {currentSeasonalText}
                </Text>
              </View>
            ) : null}

            {/* ① 今夜のリクエスト */}
            {isRequestEnabled && requestedCount > 0 ? (
              <>
                <View style={styles.homeSectionHeader}>
                  <Text style={styles.homeSectionTitle}>🙋 今夜のリクエスト（{requestedCount}件）</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                  {allRecipes
                    .filter((r) => r.isRequested)
                    .map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        style={[styles.horizontalCard, { borderColor: '#E67E22', backgroundColor: theme.isDark ? '#2E2210' : '#FEF9E7' }]}
                        activeOpacity={0.7}
                        onPress={() => {
                          setSelectedRecipe(item);
                          setIsCookingMode(false);
                          setActiveSubView('detail');
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
                          <Text style={{ fontSize: 10, color: '#E67E22', fontWeight: 'bold' }}>🙋 リクエスト中</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                </ScrollView>
              </>
            ) : null}

            {/* ② 直近の献立（被り防止） */}
            {isCookedButtonEnabled && recentCookedRecipes.length > 0 ? (
              <>
                <View style={styles.homeSectionHeader}>
                  <Text style={styles.homeSectionTitle}>🕒 直近の献立（被り防止）</Text>
                </View>
                <View style={styles.recentMealCard}>
                  {recentCookedRecipes.map((r) => (
                    <TouchableOpacity
                      key={r.id}
                      style={styles.recentMealRow}
                      onPress={() => {
                        setSelectedRecipe(r);
                        setIsCookingMode(false);
                        setActiveSubView('detail');
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
              </>
            ) : null}

            {/* ③ ★★★ 殿堂入りレシピ */}
            {topStarredRecipes.length > 0 ? (
              <>
                <View style={styles.homeSectionHeader}>
                  <Text style={styles.homeSectionTitle}>⭐ ★★★ 殿堂入り（スタメン）</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                  {topStarredRecipes.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.horizontalCard}
                      activeOpacity={0.7}
                      onPress={() => {
                        setSelectedRecipe(item);
                        setIsCookingMode(false);
                        setActiveSubView('detail');
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
                        <Text style={styles.horizontalCardRating}>★★★ リピート確定</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            ) : null}

            {/* ④ 🌱 作ってみたい（週末の冒険枠） */}
            {wantToCookRecipes.length > 0 ? (
              <>
                <View style={styles.homeSectionHeader}>
                  <Text style={styles.homeSectionTitle}>🌱 週末の挑戦（作ってみたい）</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                  {wantToCookRecipes.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.horizontalCard}
                      activeOpacity={0.7}
                      onPress={() => {
                        setSelectedRecipe(item);
                        setIsCookingMode(false);
                        setActiveSubView('detail');
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
                        <Text style={{ fontSize: 10, color: '#27AE60', fontWeight: 'bold' }}>🌱 未調理</Text>
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
          タブ2：📖 レシピ帳画面（全一覧）
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
              placeholder="料理名・カテゴリー・メモで検索..."
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
                <TouchableOpacity
                  style={[styles.card, isRequestEnabled && item.isRequested && styles.cardRequestedHighlight]}
                  activeOpacity={0.7}
                  onPress={() => {
                    setSelectedRecipe(item);
                    setIsCookingMode(false);
                    setCheckedLines({});
                    setActiveSubView('detail');
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
                      {isRequestEnabled && item.isRequested ? (
                        <View style={styles.requestedBadge}>
                          <Text style={styles.requestedBadgeText}>🙋 リクエスト中</Text>
                        </View>
                      ) : !item.isCooked ? (
                        <View style={styles.wantToCookBadge}>
                          <Text style={styles.wantToCookBadgeText}>🌱 作ってみたい</Text>
                        </View>
                      ) : item.category ? (
                        <View style={styles.categoryBadge}>
                          <Text style={styles.categoryBadgeText}>{categoryIcon} {item.category}</Text>
                        </View>
                      ) : null}
                    </View>

                    {!item.isCooked ? (
                      <Text style={styles.cardUncookedHint}>🌱 未調理（食べた後に星評価）</Text>
                    ) : (
                      <View style={styles.cardFamilyRatingRow}>
                        {members.map((m) => {
                          const rateVal = item.familyRatings?.[m.id];
                          if (rateVal === undefined) return null;
                          return (
                            <View key={m.id} style={styles.cardFamilyRatingItem}>
                              <Text style={styles.cardFamilyMemberLabel}>{m.name}</Text>
                              <Text style={styles.cardFamilyMemberStars}>{RATING_STARS[rateVal] || '☆☆☆'}</Text>
                            </View>
                          );
                        })}
                      </View>
                    )}

                    {item.notes ? (
                      <Text style={styles.cardNotes} numberOfLines={1}>💡 {item.notes}</Text>
                    ) : (
                      <Text style={styles.cardNotesEmpty}>メモ未入力</Text>
                    )}

                    <View style={styles.cardMetaRow}>
                      <Text style={styles.cardDate}>
                        {item.isDefault ? '📖 基本レシピ' : item.updatedAt ? `更新: ${item.updatedAt}` : `登録: ${item.createdAt}`}
                      </Text>
                      {item.webUrl ? <Text style={styles.cardWebBadge}>🔗 Webあり</Text> : null}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }}
          />

          <TouchableOpacity style={styles.fab} activeOpacity={0.8} onPress={pickRecipeImage}>
            <Text style={styles.fabText}>＋ レシピ追加</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* -----------------------------------------------------------
          タブ3：🍁 旬・提案画面（1月〜12月切り替え対応）
      ----------------------------------------------------------- */}
      {currentTab === 'seasonal' && (
        <View style={{ flex: 1 }}>
          <View style={styles.header}>
            <View style={styles.headerSideArea} />
            <Text style={styles.headerTitle}>🍁 旬・提案</Text>
            <View style={styles.headerSideArea} />
          </View>

          <View style={{ backgroundColor: theme.headerBg, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.border }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 12 }}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[
                    styles.filterTab,
                    selectedSeasonalMonth === m && styles.filterTabActive,
                    m === currentMonth && selectedSeasonalMonth !== m && { borderColor: theme.primary, borderWidth: 1 }
                  ]}
                  onPress={() => setSelectedSeasonalMonth(m)}
                >
                  <Text style={[styles.filterTabText, selectedSeasonalMonth === m && styles.filterTabTextActive]}>
                    {m}月{m === currentMonth ? '（今月）' : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <ScrollView style={styles.seasonalScroll}>
            <View style={styles.seasonalCard}>
              <Text style={styles.seasonalTitle}>{getSeasonIcon(selectedSeasonalMonth)} {selectedSeasonalMonth}月の旬の食材</Text>
              <Text style={styles.seasonalDesc}>
                タップすると、その食材を使った手持ちレシピを検索できます。
              </Text>
              <View style={styles.seasonalTagRow}>
                {(MONTHLY_SEASONAL_MAP[selectedSeasonalMonth] || '').split('・').map((food, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.seasonalTagBtn}
                    onPress={() => {
                      setSearchQuery(food);
                      setCurrentTab('recipes');
                    }}
                  >
                    <Text style={styles.seasonalTagText}>🔍 {food}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formCard}>
              <Text style={styles.formCardHeaderNoBorder}>💡 旬の食材を取り入れるメリット</Text>
              <Text style={{ fontSize: 13, color: theme.textSub, lineHeight: 20, marginTop: 6 }}>
                旬の時期の食材は、他の季節に比べて栄養価が2〜3倍高く、スーパーでも特売になりやすいため食費の節約に直結します。
                食材選びに迷ったら、このリストの食材を使ったレシピから選んでみてください。
              </Text>
            </View>
          </ScrollView>
        </View>
      )}

      {/* -----------------------------------------------------------
          タブ4：🛒 買い物リスト画面
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

          <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 80 }}>
            {shoppingList.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>🛒</Text>
                <Text style={styles.emptyText}>買い物リストは空です</Text>
                <Text style={styles.emptySubText}>
                  レシピ詳細画面の「🛒 買い物追加」ボタンを押すと、材料が自動でここに集まります。
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
          タブ5：⚙️ 設定画面
      ----------------------------------------------------------- */}
      {currentTab === 'settings' && (
        <View style={{ flex: 1 }}>
          <View style={styles.header}>
            <View style={styles.headerSideArea} />
            <Text style={styles.headerTitle}>⚙️ アプリの設定</Text>
            <View style={styles.headerSideArea} />
          </View>

          <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 60 }}>
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
              <Text style={styles.formCardHeader}>⚙️ 各種機能のON/OFF</Text>

              <Text style={styles.fieldLabel}>🍁 旬食材ヘッドライン</Text>
              <View style={[styles.settingToggleRow, { marginBottom: 12 }]}>
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

              <Text style={styles.fieldLabel}>🍳 「今日作った！」＆ 直近の献立</Text>
              <View style={[styles.settingToggleRow, { marginBottom: 12 }]}>
                <TouchableOpacity
                  style={[styles.settingOptionBtn, isCookedButtonEnabled && styles.settingOptionBtnActive]}
                  onPress={() => updateSetting('@setting_cooked_button_enabled', true, setIsCookedButtonEnabled)}
                >
                  <Text style={[styles.settingOptionText, isCookedButtonEnabled && styles.settingOptionTextActive]}>有効</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.settingOptionBtn, !isCookedButtonEnabled && styles.settingOptionBtnActive]}
                  onPress={() => updateSetting('@setting_cooked_button_enabled', false, setIsCookedButtonEnabled)}
                >
                  <Text style={[styles.settingOptionText, !isCookedButtonEnabled && styles.settingOptionTextActive]}>無効</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>📖 基本レシピ10品の表示</Text>
              <View style={[styles.settingToggleRow, { marginBottom: 12 }]}>
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
              <View style={[styles.settingToggleRow, { marginBottom: 12 }]}>
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

      {/* -----------------------------------------------------------
          ★ 共通：下部ボトムナビゲーションバー（Ionicons参照）
      ----------------------------------------------------------- */}
      <View style={styles.bottomNavBar}>
        {NAV_ITEMS.map((tab) => (
          <NavTabButton
            key={tab.key}
            tab={tab}
            currentTab={currentTab}
            onPress={() => setCurrentTab(tab.key)}
            styles={styles}
            unboughtCount={unboughtCount}
            theme={theme}
          />
        ))}
      </View>
    </SafeAreaView>
  );
}
