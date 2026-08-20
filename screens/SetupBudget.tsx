import { useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { Target } from "lucide-react-native";
import { currencySymbolFor } from "@/constants/currencies";
import { useAppData } from "@/contexts/AppDataContext";
import { sanitizeAmountInput } from "@/utils/amount";

export default function SetupBudget({ onSaved }: { onSaved: (amount: number) => void }) {
  const { userCurrency, t, monthNames } = useAppData();
  const [amount, setAmount] = useState("");
  const now = new Date();
  const monthLabel = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
  const parsed = parseFloat(amount) || 0;
  const disabled = !amount || parsed <= 0;

  return (
    <View className="flex-1 bg-white dark:bg-noche px-6 justify-center">
      <View className="items-center mb-8">
        <View className="w-16 h-16 rounded-3xl bg-emerald-50 items-center justify-center mb-6">
          <Target size={30} color="#059669" />
        </View>
        <Text className="text-xl font-extrabold text-slate-900 dark:text-slate-100 mb-2 text-center">{t("setup.title")}</Text>
        <Text className="text-sm text-slate-600 dark:text-slate-200 leading-relaxed text-center px-2">
          {t("setup.subtitle")}
        </Text>
      </View>

      <View>
        <Text className="text-xs font-semibold text-slate-500 dark:text-slate-300 text-center mb-2">{monthLabel}</Text>
        <Text className="text-xs font-semibold text-slate-600 dark:text-slate-200 mb-1.5 text-center">
          {t("setup.monthlyBudget")}
        </Text>
        <View className="flex-row items-center justify-center bg-slate-50 dark:bg-noche-2 rounded-2xl border-[1.5px] border-slate-200 dark:border-noche-borde px-4 py-5">
          <Text className="text-slate-500 dark:text-slate-300 font-bold text-xl mr-1">{currencySymbolFor(userCurrency)}</Text>
          <TextInput
            autoFocus
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={(v) => setAmount(sanitizeAmountInput(v))}
            placeholder="0.00"
            placeholderTextColor="#94a3b8"
            className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 text-center w-40"
          />
        </View>
      </View>

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => onSaved(parsed)}
        disabled={disabled}
        className={`w-full mt-8 bg-emerald-600 py-4 rounded-2xl items-center justify-center ${
          disabled ? "opacity-40" : ""
        }`}
      >
        <Text className="text-white font-bold">{t("setup.start")}</Text>
      </TouchableOpacity>
    </View>
  );
}
