import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { currencySymbolFor } from "@/constants/currencies";
import { useAppData } from "@/contexts/AppDataContext";

export default function EditBudgetSheet({
  current,
  onClose,
  onSave,
}: {
  current: number;
  onClose: () => void;
  onSave: (amount: number) => void;
}) {
  const { userCurrency, t } = useAppData();
  const [amount, setAmount] = useState(String(current));
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      className="absolute inset-0 z-40 justify-end"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <TouchableOpacity className="absolute inset-0 bg-slate-900/40" activeOpacity={1} onPress={onClose} />
      <View className="bg-white dark:bg-slate-900 rounded-t-3xl px-6 pt-4" style={{ paddingBottom: 32 + insets.bottom }}>
        <View className="items-center mb-4">
          <View className="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
        </View>
        <Text className="font-extrabold text-slate-900 dark:text-slate-100 text-base mb-4 text-center">
          {t("editBudget.title")}
        </Text>
        <View className="flex-row items-center justify-center bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-800 px-4 py-5 mb-5">
          <Text className="text-slate-500 dark:text-slate-300 font-bold text-xl mr-1">{currencySymbolFor(userCurrency)}</Text>
          <TextInput
            autoFocus
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ""))}
            className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 text-center w-40"
          />
        </View>
        <TouchableOpacity
          onPress={() => onSave(parseFloat(amount) || 0)}
          className="w-full bg-emerald-600 py-4 rounded-2xl items-center"
        >
          <Text className="text-white font-bold">{t("common.saveChanges")}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
