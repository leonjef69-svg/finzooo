import { useCallback, useRef } from "react";
import { useFocusEffect } from "expo-router";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check } from "lucide-react-native";
import { LANGUAGES } from "@/constants/i18n";
import { useAppData } from "@/contexts/AppDataContext";
import BackButton from "@/components/BackButton";
import { languageFlagFor } from "@/utils/decorativeFlags";

export default function LanguagePicker({
  current,
  onBack,
  onSelect,
}: {
  current: string;
  onBack: () => void;
  onSelect: (id: string) => void | Promise<void>;
}) {
  const { t, showToast } = useAppData();
  const navigationBusy = useRef(false);
  const focusVersion = useRef(0);
  useFocusEffect(useCallback(() => {
    ++focusVersion.current;
    navigationBusy.current = false;
    return () => { ++focusVersion.current; navigationBusy.current = true; };
  }, []));
  const insets = useSafeAreaInsets();

  function volver() {
    if (navigationBusy.current) return;
    navigationBusy.current = true;
    try { onBack(); } catch {
      navigationBusy.current = false;
      showToast(t("setup.selectionFailed"));
    }
  }
  async function seleccionar(id: string) {
    if (navigationBusy.current) return;
    navigationBusy.current = true;
    const version = focusVersion.current;
    try {
      await onSelect(id);
      if (version !== focusVersion.current) return;
      onBack();
    } catch {
      if (version !== focusVersion.current) return;
      navigationBusy.current = false;
      showToast(t("setup.selectionFailed"));
    }
  }

  return (
    <View className="flex-1 bg-white dark:bg-noche" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View className="flex-row items-center justify-between px-5 pt-2 pb-4">
        <BackButton onPress={volver} />
        <Text className="text-base font-bold text-slate-900 dark:text-slate-100">{t("language.title")}</Text>
        <View className="w-10" />
      </View>

      <ScrollView className="px-5" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-xs text-slate-500 dark:text-slate-300 mb-4">{t("language.subtitle")}</Text>
        <View className="gap-2.5">
          {LANGUAGES.map((l) => {
            const selected = l.id === current;
            return (
              <TouchableOpacity
                key={l.id}
                onPress={() => seleccionar(l.id)}
                accessibilityRole="button"
                accessibilityLabel={l.label}
                accessibilityState={{ selected }}
                className={`flex-row items-center justify-between rounded-2xl p-4 border-[1.5px] ${
                  selected
                    ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950"
                    : "border-slate-200 dark:border-noche-borde bg-white dark:bg-noche-2"
                }`}
              >
                <View className="flex-row items-center gap-3">
                  <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
                    className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-noche-2 items-center justify-center">
                    <Text testID="flag-decoration" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
                      className="text-xl">
                      {languageFlagFor(l.id)}
                    </Text>
                  </View>
                  <Text className="text-sm font-bold text-slate-900 dark:text-slate-100">{l.label}</Text>
                </View>
                {selected && <Check size={18} color="#059669" />}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
