import { useRef, useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";
import { useKeyboardAnimatedPadding } from "@/utils/keyboard";
import { amountInputError, parseAmountInput, sanitizeAmountInput } from "@/utils/amount";
import { sumMoney, moneyUnits } from "@/utils/moneyPrecision";
import { useAppData } from "@/contexts/AppDataContext";

/** Elegir de forma expresa, nunca reducir una meta a escondidas. */
export default function SavingsExpenseSheet({ needed, free, onCancel, onConfirm, onExpenseOnly }: {
  needed: number; free: number; onCancel: () => void;
  onConfirm: (allocations: { goalId: number; amount: number }[]) => Promise<boolean>;
  onExpenseOnly: () => void;
}) {
  const { goals, fmt, t, userCurrency, isPremium } = useAppData();
  const [values, setValues] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false), lock = useRef(false);
  const available = goals.filter(goal => goal.saved > 0);
  const allocations = available.map(goal => ({ goalId: goal.id, amount: parseAmountInput(values[goal.id] || "", userCurrency) })).filter(item => item.amount > 0);
  const valid = isPremium && moneyUnits(sumMoney(allocations.map(item => item.amount))) === moneyUnits(needed)
    && available.every(goal => !amountInputError(values[goal.id] || "", userCurrency))
    && allocations.every(item => item.amount <= goals.find(goal => goal.id === item.goalId)!.saved);
  const insets = useSafeAreaInsets();
  const { animatedPaddingStyle, keyboardVisible, onFieldFocus, onFieldBlur } = useKeyboardAnimatedPadding();
  return <Animated.View style={[{ position: "absolute", inset: 0, justifyContent: "flex-end" }, animatedPaddingStyle]}>
    <View className="absolute inset-0 bg-slate-900/40" />
    <View className="rounded-t-3xl bg-white p-5 dark:bg-noche-2" style={{ maxHeight: "100%", paddingBottom: keyboardVisible ? 20 : insets.bottom + 24 }}>
      <ScrollView keyboardShouldPersistTaps="handled">
        <Text className="text-base font-bold text-slate-900 dark:text-slate-100">{t("savings.expenseTitle")}</Text>
        <Text className="my-3 text-sm text-slate-600 dark:text-slate-200">{t("savings.expenseBody", { free: fmt(Math.max(0, free)), amount: fmt(needed) })}</Text>
        {isPremium && available.map(goal => <View key={goal.id} className="mb-3">
          <Text className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-200">{t("savings.useFrom", { name: goal.name, amount: fmt(goal.saved) })}</Text>
          <TextInput disableFullscreenUI keyboardType="decimal-pad" value={values[goal.id] || ""} placeholder="0.00" placeholderTextColor="#94a3b8"
            onChangeText={value => setValues(previous => ({ ...previous, [goal.id]: sanitizeAmountInput(value, userCurrency) }))}
            onFocus={() => onFieldFocus(String(goal.id))} onBlur={() => onFieldBlur(String(goal.id))}
            className="rounded-xl border-[1.5px] border-violet-200 px-3 py-3 text-base font-bold text-slate-900 dark:border-violet-900 dark:text-slate-100" />
        </View>)}
        {isPremium && <TouchableOpacity disabled={!valid || busy} onPress={async () => {
          if (lock.current || !valid) return; lock.current = true; setBusy(true);
          try { await onConfirm(allocations); } finally { lock.current = false; setBusy(false); }
        }} className={`items-center rounded-xl bg-violet-600 p-3 ${!valid || busy ? "opacity-40" : ""}`}><Text className="text-center font-bold text-white">{t("savings.expenseConfirm")}</Text></TouchableOpacity>}
        <Text className="mt-4 text-xs leading-5 text-slate-500 dark:text-slate-300">{t("savings.expenseWarning")}</Text>
        <TouchableOpacity disabled={busy} onPress={onExpenseOnly} className="items-center p-3"><Text className="text-center text-sm font-bold text-slate-600 dark:text-slate-200">{t("savings.expenseOnly")}</Text></TouchableOpacity>
        <TouchableOpacity disabled={busy} onPress={onCancel} className="items-center p-3"><Text className="font-bold text-slate-500 dark:text-slate-300">{t("common.cancel")}</Text></TouchableOpacity>
      </ScrollView>
    </View>
  </Animated.View>;
}
