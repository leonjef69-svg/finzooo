import { useCallback, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { FlatList, Text, TextInput, TouchableOpacity, View } from "react-native";
import { ENTRY_FONT, EntryPanel, useEntryTheme } from "@/components/EntryUI";
import { Check, Search } from "lucide-react-native";
import { useAppData } from "@/contexts/AppDataContext";
import { filterCurrencies } from "@/utils/catalogSearch";
import { currencyFlagFor } from "@/utils/decorativeFlags";

export default function CurrencyPicker({ current, onBack, onSelect }: {
  current: string;
  onBack: () => void;
  onSelect: (id: string) => void | Promise<void>;
}) {
  const { colors: ENTRY_COLORS, styles: entryStyles } = useEntryTheme();
  const { t, showToast, userLanguage, hasOnboarded } = useAppData();
  const [query, setQuery] = useState("");
  const navigationBusy = useRef(false);
  const focusVersion = useRef(0);
  const currencyLocked = useRef(hasOnboarded);
  currencyLocked.current = hasOnboarded;
  useFocusEffect(useCallback(() => {
    ++focusVersion.current;
    navigationBusy.current = false;
    return () => { ++focusVersion.current; navigationBusy.current = true; };
  }, []));
  const currencies = useMemo(
    () => filterCurrencies(query, userLanguage, t),
    [query, t, userLanguage],
  );

  function volver() {
    if (navigationBusy.current) return;
    navigationBusy.current = true;
    try { onBack(); } catch {
      navigationBusy.current = false;
      showToast(t("setup.selectionFailed"));
    }
  }
  async function seleccionar(id: string) {
    if (hasOnboarded || currencyLocked.current || navigationBusy.current) return;
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
    <EntryPanel title={t("settings.currency")} onBack={volver} closeLabel={t("common.close")} large>
      <View style={{ paddingBottom: 12 }}>
        <Text style={[entryStyles.muted, { marginBottom: 12 }]}>{t(hasOnboarded ? "currency.locked" : "currency.subtitle")}</Text>
        <View style={[entryStyles.card, { flexDirection: "row", alignItems: "center", paddingVertical: 0 }]}>
          <Search size={18} color="#94a3b8" />
          <TextInput value={query} onChangeText={setQuery} placeholder={t("currency.search")}
            placeholderTextColor="#94a3b8" autoCorrect={false}
            disableFullscreenUI
            accessibilityLabel={t("currency.search")} style={{ flex: 1, paddingVertical: 11, paddingHorizontal: 10, color: ENTRY_COLORS.ink, fontFamily: ENTRY_FONT.regular, fontSize: 15 }} />
        </View>
      </View>
      <FlatList
        data={currencies}
        keyExtractor={(currency) => currency.id}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        // En Android el recorte puede dejar filas invisibles hasta otro gesto.
        removeClippedSubviews={false}
        initialNumToRender={20}
        // El catálogo es corto: preparar la ventana estándar evita huecos
        // cuando el usuario hace un desplazamiento rápido.
        windowSize={21}
        maxToRenderPerBatch={20}
        updateCellsBatchingPeriod={16}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 16 }}
        ItemSeparatorComponent={() => <View className="h-2.5" />}
        ListEmptyComponent={<Text style={[entryStyles.text, { marginTop: 24, textAlign: "center" }]}>{t("common.noResults")}</Text>}
        renderItem={({ item: currency }) => {
            const selected = currency.id === current;
            return (
              <TouchableOpacity key={currency.id} onPress={() => seleccionar(currency.id)}
                disabled={hasOnboarded}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled: hasOnboarded }}
                accessibilityLabel={currency.name === currency.id ? currency.id : `${currency.name}. ${currency.symbol}. ${currency.id}`}
                style={[entryStyles.card, { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderColor: selected ? ENTRY_COLORS.olive : ENTRY_COLORS.line, backgroundColor: selected ? ENTRY_COLORS.soft : ENTRY_COLORS.paper }]}>
                <View className="flex-row items-center gap-3 flex-1 min-w-0">
                  <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                    <Text testID="flag-decoration" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
                      className="text-xl">{currencyFlagFor(currency.id)}</Text>
                  </View>
                  <Text style={[entryStyles.text, { flex: 1, fontFamily: ENTRY_FONT.bold }]} numberOfLines={2}>
                    {currency.name === currency.id ? currency.id : `${currency.name}${currency.symbol === currency.id ? "" : ` (${currency.symbol})`}`}
                  </Text>
                  {currency.name !== currency.id ? <Text style={entryStyles.muted}>{currency.id}</Text> : null}
                </View>
                {selected && <Check size={18} color={ENTRY_COLORS.olive} />}
              </TouchableOpacity>
            );
        }}
      />
    </EntryPanel>
  );
}
