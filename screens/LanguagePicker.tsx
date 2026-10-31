import { useCallback, useRef } from "react";
import { useFocusEffect } from "expo-router";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { ENTRY_FONT, EntryPanel, useEntryTheme } from "@/components/EntryUI";
import { Check } from "lucide-react-native";
import { LANGUAGES } from "@/constants/i18n";
import { useAppData } from "@/contexts/AppDataContext";
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
  const { colors: ENTRY_COLORS, styles: entryStyles } = useEntryTheme();
  const { t, showToast } = useAppData();
  const navigationBusy = useRef(false);
  const focusVersion = useRef(0);
  useFocusEffect(useCallback(() => {
    ++focusVersion.current;
    navigationBusy.current = false;
    return () => { ++focusVersion.current; navigationBusy.current = true; };
  }, []));

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
    <EntryPanel title={t("language.title")} onBack={volver} closeLabel={t("common.close")}>
      <ScrollView contentContainerStyle={{ paddingBottom: 8 }}>
        <Text style={[entryStyles.muted, { marginBottom: 14 }]}>{t("language.subtitle")}</Text>
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
                style={[entryStyles.card, { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderColor: selected ? ENTRY_COLORS.olive : ENTRY_COLORS.line, backgroundColor: selected ? ENTRY_COLORS.soft : ENTRY_COLORS.paper }]}
              >
                <View className="flex-row items-center gap-3">
                  <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
                    className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-noche-2 items-center justify-center">
                    <Text testID="flag-decoration" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
                      className="text-xl">
                      {languageFlagFor(l.id)}
                    </Text>
                  </View>
                  <Text style={[entryStyles.text, { fontFamily: ENTRY_FONT.bold }]}>{l.label}</Text>
                </View>
                {selected && <Check size={18} color={ENTRY_COLORS.olive} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </EntryPanel>
  );
}
