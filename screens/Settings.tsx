import { useState } from "react";
import { ActivityIndicator, Image, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import {
  Camera,
  Check,
  ChevronRight,
  Cloud,
  Crown,
  FileDown,
  FileUp,
  PiggyBank,
  PieChart,
  Globe,
  Coins,
  Palette,
  Bell,
  KeyRound,
  Pencil,
  UserX,
  LogOut,
  Info,
  Shield,
  X,
} from "lucide-react-native";
import { useColorScheme } from "nativewind";
import Row from "@/components/Row";
import ThemeToggleButton from "@/components/ThemeToggleButton";
import Toggle from "@/components/Toggle";
import { currencyLabelFor } from "@/constants/currencies";
import { languageLabelFor } from "@/constants/i18n";
import { useAppData } from "@/contexts/AppDataContext";

// Achica y comprime la foto antes de guardarla, para que no pese mucho
// (así se guarda rápido y no ocupa espacio de más en la nube).
async function compressPhoto(uri: string): Promise<string> {
  const context = ImageManipulator.manipulate(uri).resize({ width: 240 });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ base64: true, compress: 0.5, format: SaveFormat.JPEG });
  return `data:image/jpeg;base64,${saved.base64}`;
}

export default function Settings({
  userName,
  userEmail,
  userPhoto,
  onSaveProfile,
  userCurrency,
  onCurrency,
  userLanguage,
  onLanguage,
  onTheme,
  isPremium,
  onCategoryBudgets,
  onExportPdf,
  onImport,
  onLogout,
  onPremium,
  onSavings,
  onChangePassword,
  onDeleteAccount,
  onAbout,
  onLegal,
}: {
  userName: string;
  userEmail: string;
  userPhoto: string | null;
  onSaveProfile: (name: string, photo: string | null) => void;
  userCurrency: string;
  onCurrency: () => void;
  userLanguage: string;
  onLanguage: () => void;
  onTheme: () => void;
  isPremium: boolean;
  onCategoryBudgets: () => void;
  onExportPdf: () => void;
  onImport: () => void;
  onLogout: () => void;
  onPremium: () => void;
  onSavings: () => void;
  onChangePassword: () => void;
  onDeleteAccount: () => void;
  onAbout: () => void;
  onLegal: () => void;
}) {
  const { t, isCloudSynced } = useAppData();
  const { colorScheme } = useColorScheme();
  const primaryTextColor = colorScheme === "dark" ? "#f1f5f9" : "#0f172a";
  const [notif, setNotif] = useState(true);
  const insets = useSafeAreaInsets();

  const [pickingPhoto, setPickingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(userName);
  const [nameError, setNameError] = useState("");

  async function pickPhoto() {
    setPhotoError("");
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setPhotoError(t("settings.photoPermission"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;

    setPickingPhoto(true);
    try {
      const compressed = await compressPhoto(result.assets[0].uri);
      onSaveProfile(userName, compressed);
    } catch {
      setPhotoError(t("settings.photoError"));
    } finally {
      setPickingPhoto(false);
    }
  }

  function startEditName() {
    setNameInput(userName);
    setNameError("");
    setEditingName(true);
  }

  function saveName() {
    if (nameInput.trim().length < 2) {
      setNameError(t("settings.nameError"));
      return;
    }
    onSaveProfile(nameInput.trim(), userPhoto);
    setEditingName(false);
  }

  return (
    <ScrollView
      className="flex-1 bg-white dark:bg-slate-900"
      contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 112 }}
    >
      <View className="px-5 pt-3 pb-1 flex-row items-center justify-between">
        <Text className="text-xl font-extrabold" style={{ color: primaryTextColor }}>{t("settings.title")}</Text>
        <ThemeToggleButton />
      </View>

      <View className="mx-5 mt-3 bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 items-center">
        <TouchableOpacity onPress={pickPhoto} disabled={pickingPhoto} activeOpacity={0.8}>
          <View className="w-20 h-20 rounded-full bg-emerald-600 items-center justify-center overflow-hidden">
            {userPhoto ? (
              <Image source={{ uri: userPhoto }} style={{ width: 80, height: 80 }} />
            ) : (
              <Text className="text-white text-2xl font-extrabold">{userName[0]}</Text>
            )}
          </View>
          <View className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-slate-900 items-center justify-center border-2 border-white">
            {pickingPhoto ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Camera size={12} color="#ffffff" />
            )}
          </View>
        </TouchableOpacity>
        {photoError ? (
          <Text className="text-rose-500 text-xs font-medium mt-2 text-center">{photoError}</Text>
        ) : null}

        {editingName ? (
          <View className="flex-row items-center gap-2 mt-3">
            <TextInput
              value={nameInput}
              onChangeText={setNameInput}
              placeholder={t("settings.namePlaceholder")}
              autoFocus
              className="text-sm font-bold text-center border-b border-emerald-400 py-1 min-w-[120px]"
              style={{ color: primaryTextColor }}
            />
            <TouchableOpacity
              onPress={saveName}
              className="w-7 h-7 rounded-full bg-emerald-600 items-center justify-center"
            >
              <Check size={14} color="#ffffff" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setEditingName(false)}
              className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 items-center justify-center"
            >
              <X size={14} color="#64748b" />
            </TouchableOpacity>
          </View>
        ) : (
          <View className="flex-row items-center gap-1.5 mt-3">
            <Text className="font-bold text-sm" style={{ color: primaryTextColor }}>{userName}</Text>
            <TouchableOpacity
              onPress={startEditName}
              className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 items-center justify-center"
            >
              <Pencil size={11} color="#64748b" />
            </TouchableOpacity>
          </View>
        )}
        {nameError ? <Text className="text-rose-500 text-xs font-medium mt-1">{nameError}</Text> : null}
        <Text className="text-xs text-slate-500 dark:text-slate-300 mt-0.5">{userEmail}</Text>
      </View>

      <TouchableOpacity onPress={onPremium} className="mx-5 mt-3 rounded-2xl overflow-hidden">
        <LinearGradient
          colors={["#fbbf24", "#f59e0b"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          className="flex-row items-center gap-3 p-4"
        >
          <Crown size={20} color="#ffffff" />
          <View className="flex-1">
            <Text className="font-extrabold text-white text-sm">
              {isPremium ? t("settings.premiumActive") : t("settings.becomePremium")}
            </Text>
            <Text className="text-[11px] text-amber-50">
              {isPremium ? t("settings.premiumThanks") : t("settings.premiumUnlock")}
            </Text>
          </View>
          <ChevronRight size={16} color="#ffffff" />
        </LinearGradient>
      </TouchableOpacity>

      {isCloudSynced && (
        <View className="mx-5 mt-3 flex-row items-center gap-3 bg-emerald-50 dark:bg-slate-800 rounded-2xl p-3.5 border border-emerald-100 dark:border-slate-700">
          <View className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-slate-700 items-center justify-center">
            <Cloud size={16} color="#059669" />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-bold text-emerald-700 dark:text-slate-100">
              {t("settings.backupActive")}
            </Text>
            <Text className="text-[11px] text-emerald-600 dark:text-slate-300">
              {t("settings.backupDescription")}
            </Text>
          </View>
        </View>
      )}

      <View className="px-5 mt-5 gap-2.5">
        <Text className="text-xs font-bold text-slate-500 dark:text-slate-300 px-1">{t("settings.sectionSettings")}</Text>
        <Row
          Icon={PieChart}
          label={t("categoryBudgets.rowLabel")}
          onPress={onCategoryBudgets}
          right={
            <View className="bg-amber-50 px-2 py-1 rounded-full">
              <Text className="text-[10px] font-extrabold text-amber-500">PRO</Text>
            </View>
          }
        />
        <Row
          Icon={FileDown}
          label={t("exportPdf.exportDataTitle")}
          onPress={onExportPdf}
          right={
            <View className="bg-amber-50 px-2 py-1 rounded-full">
              <Text className="text-[10px] font-extrabold text-amber-500">PRO</Text>
            </View>
          }
        />
        <Row
          Icon={FileUp}
          label={t("importSheet.rowLabel")}
          onPress={onImport}
          right={
            <View className="bg-amber-50 px-2 py-1 rounded-full">
              <Text className="text-[10px] font-extrabold text-amber-500">PRO</Text>
            </View>
          }
        />
        <Row
          Icon={PiggyBank}
          label={t("settings.savingsGoals")}
          onPress={onSavings}
          right={
            <View className="bg-amber-50 px-2 py-1 rounded-full">
              <Text className="text-[10px] font-extrabold text-amber-500">PRO</Text>
            </View>
          }
        />
        <Row
          Icon={Globe}
          label={`${t("settings.language")} · ${languageLabelFor(userLanguage)}`}
          onPress={onLanguage}
          right={<ChevronRight size={16} color="#cbd5e1" />}
        />
        <Row
          Icon={Coins}
          label={`${t("settings.currency")} · ${currencyLabelFor(userCurrency, t)}`}
          onPress={onCurrency}
          right={<ChevronRight size={16} color="#cbd5e1" />}
        />
        <Row
          Icon={Palette}
          label={t("settings.theme")}
          onPress={onTheme}
          right={<ChevronRight size={16} color="#cbd5e1" />}
        />
        <Row Icon={Bell} label={t("settings.notifications")} right={<Toggle on={notif} onChange={setNotif} />} />
      </View>

      <View className="px-5 mt-5 gap-2.5">
        <Text className="text-xs font-bold text-slate-500 dark:text-slate-300 px-1">{t("settings.sectionAccount")}</Text>
        <Row
          Icon={KeyRound}
          label={t("settings.changePassword")}
          onPress={onChangePassword}
          right={<ChevronRight size={16} color="#cbd5e1" />}
        />
        <Row Icon={UserX} label={t("settings.deleteAccount")} onPress={onDeleteAccount} danger />
        <Row Icon={LogOut} label={t("settings.logout")} onPress={onLogout} danger />
      </View>

      <View className="px-5 mt-5 gap-2.5">
        <Text className="text-xs font-bold text-slate-500 dark:text-slate-300 px-1">{t("settings.sectionInfo")}</Text>
        <Row
          Icon={Info}
          label={t("settings.appInfo")}
          onPress={onAbout}
          right={<ChevronRight size={16} color="#cbd5e1" />}
        />
        <Row
          Icon={Shield}
          label={t("settings.legal")}
          onPress={onLegal}
          right={<ChevronRight size={16} color="#cbd5e1" />}
        />
      </View>
    </ScrollView>
  );
}
