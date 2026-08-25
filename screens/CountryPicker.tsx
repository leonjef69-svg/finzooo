import { useMemo, useState } from "react";
import { FlatList, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, Search } from "lucide-react-native";
import { countriesFor, countryFor, countryLabelFor } from "@/constants/countries";
import { currencySymbolFor } from "@/constants/currencies";
import { languageLabelFor } from "@/constants/i18n";
import { useAppData } from "@/contexts/AppDataContext";
import BackButton from "@/components/BackButton";

export default function CountryPicker({ onBack, onSelect }: {
  onBack: () => void;
  onSelect: (country: string, language: string, currency: string) => void;
}) {
  const { t, userLanguage, userCurrency, userCountry } = useAppData();
  const [query, setQuery] = useState("");
  const insets = useSafeAreaInsets();
  const actual = countryFor(userLanguage, userCurrency, userCountry);
  const countries = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase(userLanguage);
    return countriesFor(userLanguage).filter((country) => {
      if (!normalized) return true;
      const name = countryLabelFor(country, userLanguage).toLocaleLowerCase(userLanguage);
      return name.includes(normalized)
        || country.id.toLowerCase().includes(normalized)
        || country.currency.toLowerCase().includes(normalized);
    });
  }, [query, userLanguage]);

  return (
    <View className="flex-1 bg-white dark:bg-noche" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View className="flex-row items-center justify-between px-5 pt-2 pb-4">
        <BackButton onPress={onBack} />
        <Text className="text-base font-bold text-slate-900 dark:text-slate-100">{t("settings.country")}</Text>
        <View className="w-10" />
      </View>
      <View className="px-5 pb-3">
        <Text className="text-xs text-slate-500 dark:text-slate-300 mb-3">{t("country.subtitle")}</Text>
        <View className="flex-row items-center rounded-2xl border-[1.5px] border-slate-200 dark:border-noche-borde bg-slate-50 dark:bg-noche-2 px-4">
          <Search size={18} color="#94a3b8" />
          <TextInput value={query} onChangeText={setQuery} placeholder={t("country.search")}
            placeholderTextColor="#94a3b8" autoCorrect={false}
            disableFullscreenUI
            className="flex-1 py-3 px-3 text-sm text-slate-900 dark:text-slate-100" />
        </View>
      </View>
      <FlatList
        data={countries}
        keyExtractor={(country) => country.id}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={10}
        windowSize={5}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
        ItemSeparatorComponent={() => <View className="h-2.5" />}
        ListFooterComponent={!actual && !query ? (
          <View className="mt-4 rounded-2xl border-[1.5px] border-slate-200 dark:border-noche-borde bg-slate-50 dark:bg-noche-2 p-4">
            <Text className="text-xs text-slate-600 dark:text-slate-300 leading-5">
              {t("country.custom", { language: languageLabelFor(userLanguage), currency: currencySymbolFor(userCurrency) })}
            </Text>
          </View>
        ) : null}
        renderItem={({ item: country }) => {
            const selected = actual?.id === country.id;
            return (
              <TouchableOpacity key={country.id}
                onPress={() => { onSelect(country.id, country.language, country.currency); onBack(); }}
                className={`flex-row items-center gap-3 rounded-2xl p-4 border-[1.5px] ${selected
                  ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20"
                  : "border-slate-200 dark:border-noche-borde bg-white dark:bg-noche-2"}`}>
                <Text className="text-2xl">{country.flag}</Text>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-slate-900 dark:text-slate-100">{countryLabelFor(country, userLanguage)}</Text>
                  <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {languageLabelFor(country.language)} · {country.currency} · {currencySymbolFor(country.currency)}
                  </Text>
                </View>
                {selected && <Check size={18} color="#059669" />}
              </TouchableOpacity>
            );
        }}
      />
    </View>
  );
}
