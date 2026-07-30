import { useEffect, useState } from "react";
import { Keyboard, Text, TextInput, TouchableOpacity, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import ConfirmDialog from "@/components/ConfirmDialog";
import { currencySymbolFor } from "@/constants/currencies";
import { useAppData } from "@/contexts/AppDataContext";
import { sanitizeAmountInput } from "@/utils/amount";
import { useKeyboardAnimatedPadding } from "@/utils/keyboard";
import type { Goal } from "@/types";
import { useColorScheme } from "nativewind";

export default function MoveMoneySheet({
  mode,
  goal,
  onClose,
  onConfirm,
}: {
  mode: "add" | "withdraw";
  goal: Goal;
  onClose: () => void;
  onConfirm: (amount: number) => void;
}) {
  const { userCurrency, fmt, t } = useAppData();
  const [amount, setAmount] = useState("");
  const [confirming, setConfirming] = useState(false);
  const isAdd = mode === "add";
  const amt = parseFloat(amount) || 0;
  const valid = amt > 0 && (isAdd || amt <= goal.saved);
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();

  // Igual que en AddSheet: el hueco del teclado lo entrega Reanimated.
  const { animatedPaddingStyle, keyboardVisible, onFieldFocus, onFieldBlur } =
    useKeyboardAnimatedPadding();

  // Igual que en AddSheet: se cierra el teclado a propósito al salir de
  // esta pantalla, para que la siguiente hoja no herede un estado "sigue
  // abierto" que ya no es real.
  useEffect(() => {
    return () => {
      Keyboard.dismiss();
    };
  }, []);

  return (
    <Animated.View
      style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "flex-end" }, animatedPaddingStyle]}
    >
      <TouchableOpacity className="absolute inset-0 bg-slate-900/40" activeOpacity={1} onPress={onClose} />
      <View
        className="bg-white dark:bg-slate-900 rounded-t-3xl px-5 pt-3"
        style={{
          maxHeight: "100%",
          paddingBottom: keyboardVisible ? 20 : 32 + insets.bottom,
        }}
      >
        <View className="items-center mb-3">
          <View className="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
        </View>
        <View className="flex-row items-center justify-between mb-1">
          <Text className="font-extrabold text-slate-900 dark:text-slate-100 text-base">
            {isAdd ? t("moveMoney.addTitle") : t("moveMoney.withdrawTitle")}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 items-center justify-center"
          >
            <X size={16} color={colorScheme === "dark" ? "#94a3b8" : "#475569"} />
          </TouchableOpacity>
        </View>
        <Text className="text-xs text-slate-500 dark:text-slate-300 mb-4">
          {t("moveMoney.savedLabel", { goalName: goal.name, amount: fmt(goal.saved) })}
        </Text>
        <View className="items-center justify-center bg-slate-50 dark:bg-slate-800 rounded-2xl border-[1.5px] border-slate-200 dark:border-slate-700 px-4 py-5 mb-2 flex-row">
          <Text className="text-slate-500 dark:text-slate-300 font-bold text-xl mr-1">{currencySymbolFor(userCurrency)}</Text>
          <TextInput
            autoFocus
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={(v) => setAmount(sanitizeAmountInput(v))}
            onFocus={() => onFieldFocus("amount")}
            onBlur={() => onFieldBlur("amount")}
            placeholder="0.00"
            placeholderTextColor="#94a3b8"
            className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 text-center w-40"
          />
        </View>
        {!isAdd && amt > goal.saved && (
          <Text className="text-rose-500 text-xs font-semibold text-center mb-2">
            {t("moveMoney.cannotWithdrawMore")}
          </Text>
        )}
        <TouchableOpacity
          disabled={!valid}
          onPress={() => (isAdd ? onConfirm(amt) : setConfirming(true))}
          className={`w-full mt-4 py-4 rounded-2xl items-center ${
            isAdd ? "bg-emerald-600" : "bg-rose-500"
          } ${!valid ? "opacity-40" : ""}`}
        >
          <Text className="text-white font-bold">{isAdd ? t("moveMoney.add") : t("moveMoney.withdraw")}</Text>
        </TouchableOpacity>
      </View>

      <ConfirmDialog
        visible={confirming}
        title={t("moveMoney.confirmWithdrawTitle", { amount: fmt(amt) })}
        message={t("moveMoney.confirmWithdrawMessage", { name: goal.name })}
        confirmLabel={t("moveMoney.withdraw")}
        cancelLabel={t("common.cancel")}
        onCancel={() => setConfirming(false)}
        onConfirm={() => onConfirm(amt)}
      />
    </Animated.View>
  );
}
