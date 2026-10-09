import { useEffect, useMemo, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { Camera, Check, ImagePlus, Pencil, Plus, X } from "lucide-react-native";
import { BackHandler, Image, Keyboard, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CategoryAvatar from "@/components/CategoryAvatar";
import ImageCropper from "@/components/ImageCropper";
import type { Category } from "@/constants/categories";
import { useAppData } from "@/contexts/AppDataContext";
import { nombreRepetido } from "@/utils/categoriasPropias";
import { sanitizeName } from "@/utils/categoryCustom";

type Props = {
  type: "expense" | "income";
  categories: Category[];
  selectedId: string;
  onClose: () => void;
  onSelect: (id: string) => void;
  onManage?: () => void;
  initialCreate?: boolean;
};

export default function TransactionCategorySheet({ type, categories, selectedId, onClose, onSelect, onManage, initialCreate = false }: Props) {
  const { t, categoriasPropias, crearCategoria, showToast } = useAppData();
  const insets = useSafeAreaInsets();
  const [creating, setCreating] = useState(initialCreate);
  const [name, setName] = useState("");
  const [image, setImage] = useState<string | undefined>();
  const [cropUri, setCropUri] = useState<string | null>(null);

  const cleanName = sanitizeName(name);
  const repeated = useMemo(
    () => nombreRepetido(categoriasPropias, cleanName, type),
    [categoriasPropias, cleanName, type],
  );
  const canCreate = cleanName.length > 0 && !repeated;

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (Keyboard.isVisible()) {
        Keyboard.dismiss();
        return true;
      }
      if (cropUri) {
        setCropUri(null);
        return true;
      }
      if (creating) {
        setCreating(false);
        return true;
      }
      Keyboard.dismiss();
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [creating, cropUri, onClose]);

  function close() {
    Keyboard.dismiss();
    onClose();
  }

  async function chooseImage(source: "camera" | "library") {
    try {
      if (source === "camera") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          showToast(t("catCustom.cameraPermission"));
          return;
        }
        const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1 });
        if (!result.canceled && result.assets[0]) setCropUri(result.assets[0].uri);
        return;
      }

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showToast(t("settings.photoPermission"));
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
      if (!result.canceled && result.assets[0]) setCropUri(result.assets[0].uri);
    } catch {
      showToast(t("catCustom.cropError"));
    }
  }

  function saveCategory() {
    if (!canCreate) return;
    Keyboard.dismiss();
    const id = crearCategoria({
      nombre: cleanName,
      tipo: type,
      color: "emerald",
      icono: "Tag",
      ...(image ? { image } : {}),
    });
    showToast(t("nuevaCat.creada"));
    onSelect(id);
  }

  return (
    <View className="absolute inset-0 z-50 justify-end">
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t("common.cancel")}
        activeOpacity={1}
        onPress={close}
        className="absolute inset-0 bg-slate-950/45"
      />
      <View
        className="overflow-hidden rounded-t-[28px] border-t border-slate-200 bg-white dark:border-noche-borde dark:bg-noche-2"
        style={{ maxHeight: "82%", paddingBottom: Math.max(insets.bottom, 12) }}
      >
        <View className="items-center pt-2 pb-1">
          <View className="h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-600" />
        </View>
        <View className="flex-row items-center justify-between px-5 pb-3 pt-1">
          {creating ? (
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("common.back")} hitSlop={6} onPress={() => { Keyboard.dismiss(); setCreating(false); }} className="h-9 w-9 items-center justify-center rounded-full bg-slate-100 dark:bg-noche-3">
              <X size={17} color="#64748b" />
            </TouchableOpacity>
          ) : (
            <View className="h-9 w-9 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950">
              <CategoryAvatar id={selectedId} size={18} />
            </View>
          )}
          <Text className="text-base font-extrabold text-slate-900 dark:text-slate-100">
            {creating ? t("nuevaCat.title") : t("elegirCat.title")}
          </Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("common.close")} hitSlop={6} onPress={close} className="h-9 w-9 items-center justify-center rounded-full bg-slate-100 dark:bg-noche-3">
            <X size={17} color="#64748b" />
          </TouchableOpacity>
        </View>

        {creating ? (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 18, gap: 12 }}>
            <TextInput
              disableFullscreenUI
              autoFocus
              value={name}
              onChangeText={setName}
              placeholder={t("nuevaCat.nombrePlaceholder")}
              placeholderTextColor="#94a3b8"
              maxLength={24}
              returnKeyType="done"
              className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 dark:border-noche-borde dark:bg-noche-3 dark:text-slate-100"
            />
            {repeated ? <Text className="-mt-2 text-xs font-semibold text-rose-600">{t("nuevaCat.repetido")}</Text> : null}

            <View className="flex-row items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-noche-borde dark:bg-noche-3">
              <View className="h-14 w-14 overflow-hidden items-center justify-center rounded-2xl border border-slate-200 bg-white dark:border-noche-borde dark:bg-noche-2">
                {image ? <Image source={{ uri: image }} className="h-full w-full" resizeMode="cover" /> : <CategoryAvatar id="otros" size={23} />}
              </View>
              <View className="min-w-0 flex-1">
                <Text className="text-sm font-bold text-slate-800 dark:text-slate-100" numberOfLines={1}>
                  {cleanName || t("nuevaCat.sinNombre")}
                </Text>
                <Text className="mt-0.5 text-xs text-slate-500 dark:text-slate-300">{t("catCustom.image")}</Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t("nuevaCat.abrirCamara")}
                onPress={() => void chooseImage("camera")}
                className="h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white dark:border-noche-borde dark:bg-noche-2"
              >
                <Camera size={18} color="#526b43" />
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t("nuevaCat.abrirGaleria")}
                onPress={() => void chooseImage("library")}
                className="h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white dark:border-noche-borde dark:bg-noche-2"
              >
                <ImagePlus size={18} color="#526b43" />
              </TouchableOpacity>
            </View>

            <View className="flex-row gap-2 pt-1">
              <TouchableOpacity onPress={() => { Keyboard.dismiss(); setCreating(false); }} className="h-12 flex-1 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 dark:border-noche-borde dark:bg-noche-3">
                <Text className="text-sm font-bold text-slate-600 dark:text-slate-200">{t("nuevaCat.cancelar")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={!canCreate}
                onPress={saveCategory}
                className={`h-12 flex-1 flex-row items-center justify-center gap-2 rounded-2xl ${canCreate ? "bg-emerald-600" : "bg-slate-300 dark:bg-slate-700"}`}
              >
                <Check size={17} color="#ffffff" />
                <Text className="text-sm font-extrabold text-white">{t("common.save")}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : (
          <>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 10 }}>
              <View className="flex-row flex-wrap gap-2.5">
                {categories.map((item) => {
                  const selected = item.id === selectedId;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => { Keyboard.dismiss(); onSelect(item.id); }}
                      className={`min-h-[58px] w-[31%] flex-grow flex-row items-center gap-2 rounded-2xl border px-2.5 ${selected ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950" : "border-slate-200 bg-slate-50 dark:border-noche-borde dark:bg-noche-3"}`}
                    >
                      <CategoryAvatar id={item.id} size={19} />
                      <Text numberOfLines={1} className={`min-w-0 flex-1 text-xs font-semibold ${selected ? "text-emerald-800 dark:text-emerald-200" : "text-slate-700 dark:text-slate-200"}`}>
                        {t(item.label)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
            <View className="flex-row gap-2 px-5 pb-3 pt-2">
              {onManage ? <TouchableOpacity
                accessibilityRole="button"
                onPress={onManage}
                className="h-12 flex-[0.95] flex-row items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 dark:border-noche-borde dark:bg-noche-3"
              >
                <Pencil size={15} color="#64748b" />
                <Text numberOfLines={1} className="text-xs font-bold text-slate-700 dark:text-slate-200">{t("catCustom.rowLabel")}</Text>
              </TouchableOpacity> : null}
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => setCreating(true)}
                className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950"
              >
                <Plus size={18} color="#526b43" />
                <Text className="text-sm font-extrabold text-emerald-800 dark:text-emerald-200">{t("nuevaCat.title")}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {cropUri ? (
        <View className="absolute inset-0 z-[60] bg-[#17100c]">
          <ImageCropper
            uri={cropUri}
            onCancel={() => setCropUri(null)}
            onDone={(result) => { setImage(result.base64); setCropUri(null); }}
            labels={{
              title: t("catCustom.cropTitle"),
              hint: t("catCustom.cropHint"),
              cancel: t("common.cancel"),
              save: t("common.save"),
              error: t("catCustom.cropError"),
              zoomOut: t("accessibility.zoomOut"),
              zoomIn: t("accessibility.zoomIn"),
            }}
          />
        </View>
      ) : null}
    </View>
  );
}
