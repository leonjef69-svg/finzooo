import { useMemo, useState } from "react";
import { FlatList, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, Search } from "lucide-react-native";
import { CURRENCIES, currencyLabelFor } from "@/constants/currencies";
import { useAppData } from "@/contexts/AppDataContext";
import BackButton from "@/components/BackButton";

export default function CurrencyPicker({ current, onBack, onSelect }: {
  current: string;
  onBack: () => void;
  onSelect: (id: string) => void;
}) {
  const { t, userLanguage } = useAppData();
  const [query, setQuery] = useState("");
  const insets = useSafeAreaInsets();
  const currencies = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase(userLanguage);
    return CURRENCIES
      .map((currency) => ({ ...currency, name: currencyLabelFor(currency.id, t, userLanguage) }))
      .filter((currency) => !normalized
        || currency.name.toLocaleLowerCase(userLanguage).includes(normalized)
        || currency.id.toLowerCase().includes(normalized)
        || currency.symbol.toLocaleLowerCase(userLanguage).includes(normalized));
  }, [query, t, userLanguage]);

  return (
    <View className="flex-1 bg-white dark:bg-noche" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View className="flex-row items-center justify-between px-5 pt-2 pb-4">
        <BackButton onPress={onBack} />
        <Text className="text-base font-bold text-slate-900 dark:text-slate-100">{t("settings.currency")}</Text>
        <View className="w-10" />
      </View>
      <View className="px-5 pb-3">
        <Text className="text-xs text-slate-500 dark:text-slate-300 mb-3">{t("currency.subtitle")}</Text>
        <View className="flex-row items-center rounded-2xl border-[1.5px] border-slate-200 dark:border-noche-borde bg-slate-50 dark:bg-noche-2 px-4">
          <Search size={18} color="#94a3b8" />
          <TextInput value={query} onChangeText={setQuery} placeholder={t("currency.search")}
            placeholderTextColor="#94a3b8" autoCorrect={false}
            disableFullscreenUI
            className="flex-1 py-3 px-3 text-sm text-slate-900 dark:text-slate-100" />
        </View>
      </View>
      <FlatList
        data={currencies}
        keyExtractor={(currency) => currency.id}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={10}
        windowSize={5}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
        ItemSeparatorComponent={() => <View className="h-2.5" />}
        renderItem={({ item: currency }) => {
            const selected = currency.id === current;
            return (
              <TouchableOpacity key={currency.id} onPress={() => { onSelect(currency.id); onBack(); }}
                className={`flex-row items-center justify-between rounded-2xl p-4 border-[1.5px] ${selected
                  ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950"
                  : "border-slate-200 dark:border-noche-borde bg-white dark:bg-noche-2"}`}>
                <View className="flex-row items-center gap-3 flex-1">
                  <View className="w-12 h-9 rounded-xl bg-slate-50 dark:bg-noche-2 items-center justify-center">
                    <Text className="text-xs font-extrabold text-slate-700 dark:text-slate-200">{currency.symbol}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-slate-900 dark:text-slate-100">{currency.name}</Text>
                    <Text className="text-[11px] text-slate-500 dark:text-slate-400">{currency.id}</Text>
                  </View>
                </View>
                {selected && <Check size={18} color="#059669" />}
              </TouchableOpacity>
            );
        }}
      />
    </View>
  );
}
