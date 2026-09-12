import { useMemo, useState } from "react";
import { FlatList, Image, StatusBar, Text, TextInput, TouchableOpacity, View } from "react-native";
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
    <View className="flex-1 bg-[#17100c]" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <Image source={require("../assets/images/onboarding/fino-person-background.png")} resizeMode="cover" blurRadius={9} className="absolute inset-0 h-full w-full" />
      <View className="absolute inset-0 bg-black/50" />
      <View className="flex-row items-center justify-between px-5 pt-2 pb-4">
        <BackButton onPress={onBack} onDark />
        <Text className="text-base font-bold text-white">{t("settings.currency")}</Text>
        <View className="w-10" />
      </View>
      <View className="px-5 pb-3">
        <Text className="text-xs text-white/80 mb-3">{t("currency.subtitle")}</Text>
        <View className="flex-row items-center rounded-2xl border-[1.5px] border-white/50 bg-white/95 px-4">
          <Search size={18} color="#94a3b8" />
          <TextInput value={query} onChangeText={setQuery} placeholder={t("currency.search")}
            placeholderTextColor="#94a3b8" autoCorrect={false}
            disableFullscreenUI
            className="flex-1 py-3 px-3 text-sm text-slate-900" />
        </View>
      </View>
      <FlatList
        data={currencies}
        keyExtractor={(currency) => currency.id}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        initialNumToRender={10}
        windowSize={5}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
        ItemSeparatorComponent={() => <View className="h-2.5" />}
        renderItem={({ item: currency }) => {
            const selected = currency.id === current;
            return (
              <TouchableOpacity key={currency.id} onPress={() => { onSelect(currency.id); onBack(); }}
                accessibilityRole="button"
                accessibilityLabel={currency.name === currency.id ? currency.id : `${currency.name}. ${currency.symbol}. ${currency.id}`}
                className={`flex-row items-center justify-between rounded-2xl p-4 border-[1.5px] ${selected
                  ? "border-amber-500 bg-amber-50"
                  : "border-white/50 bg-white/95"}`}>
                <View className="flex-row items-center gap-3 flex-1 min-w-0">
                  <Text className="flex-1 text-sm font-bold text-slate-900" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
                    {currency.name === currency.id ? currency.id : `${currency.name}${currency.symbol === currency.id ? "" : ` (${currency.symbol})`}`}
                  </Text>
                  {currency.name !== currency.id ? <Text className="text-xs font-extrabold text-slate-500">{currency.id}</Text> : null}
                </View>
                {selected && <Check size={18} color="#d97706" />}
              </TouchableOpacity>
            );
        }}
      />
    </View>
  );
}
