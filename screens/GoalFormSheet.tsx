import { useEffect, useRef, useState } from "react";
import { Keyboard, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { nextId } from "@/utils/id";
import { amountInputError, parseAmountInput, sanitizeAmountInput } from "@/utils/amount";
import { useKeyboardAnimatedPadding } from "@/utils/keyboard";
import { fechaLocalISO } from "@/utils/date";
import { metaConEstadoActual } from "@/utils/ahorro";
import { currencySymbolFor } from "@/constants/currencies";
import { useAppData } from "@/contexts/AppDataContext";
import type { Goal } from "@/types";
import { useColorScheme } from "nativewind";
import { useSavingsBalance } from "@/utils/useSavingsBalance";

export default function GoalFormSheet({
  goal,
  onClose,
  onSave,
}: {
  goal?: Goal;
  onClose: () => void;
  onSave: (g: Goal, initial?: number, expectedSaved?: number) => Promise<boolean> | boolean | void;
}) {
  const { userCurrency, t, fmt, showToast } = useAppData();
  const { free: libre, max: maximoAApartar } = useSavingsBalance();
  const [name, setName] = useState(goal?.name || "");
  const [target, setTarget] = useState(goal ? String(goal.target) : "");
  const [initial, setInitial] = useState("");
  const [saved, setSaved] = useState(goal ? String(goal.saved) : "");
  const [originalSaved] = useState(goal?.saved ?? 0);
  const desiredSaved = parseAmountInput(saved, userCurrency);
  const savedError = amountInputError(saved, userCurrency);
  const initialAmount = parseAmountInput(initial, userCurrency);
  const delta = goal ? desiredSaved - originalSaved : initialAmount;
  const [goalId] = useState(() => goal?.id ?? nextId());
  const saveLock = useRef(false);
  const [guardando, setGuardando] = useState(false);
  const initialError = amountInputError(initial, userCurrency);
  const stale = Boolean(goal && goal.saved !== originalSaved);
  const valid = !stale && name.trim().length > 0 && parseAmountInput(target, userCurrency) > 0
    && (goal ? !savedError && desiredSaved >= 0 && desiredSaved <= originalSaved + maximoAApartar : !initialError && initialAmount >= 0 && initialAmount <= maximoAApartar);
  const createdDate = goal?.createdDate || fechaLocalISO();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();

  // El hueco del teclado lo entrega Reanimated (ver utils/keyboard.ts).
  // onFieldFocus/onFieldBlur hay que llamarlos desde cada campo de texto
  // (fuera de Expo Go no hacen nada; dentro de Expo Go son los que de
  // verdad deciden si se ve el panel de Guardar — ver utils/keyboard.ts).
  const { animatedPaddingStyle, keyboardVisible, onFieldFocus, onFieldBlur } =
    useKeyboardAnimatedPadding();

  // Al cerrar sin avisarle al teclado, el sistema puede quedarse creyendo
  // "sigue abierto" y la SIGUIENTE hoja que se abra hereda ese estado
  // viejo (ver el porqué completo en AddSheet.tsx). Se cierra a propósito
  // al salir de esta pantalla, sea cual sea el botón que la cerró.
  useEffect(() => {
    return () => {
      Keyboard.dismiss();
    };
  }, []);

  return (
    <Animated.View
      style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "flex-end" }, animatedPaddingStyle]}
    >
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("common.close")} className="absolute inset-0 bg-slate-900/40" activeOpacity={1} onPress={onClose} />
      <View
        className="bg-white dark:bg-noche-2 rounded-t-3xl px-5 pt-3"
        style={{
          maxHeight: "100%",
          paddingBottom: keyboardVisible ? 20 : 32 + insets.bottom,
        }}
      >
        <View className="items-center mb-3">
          <View className="w-10 h-1 rounded-full bg-slate-200 dark:bg-noche-3" />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center justify-between mb-4">
          <Text className="font-extrabold text-slate-900 dark:text-slate-100 text-base">
            {goal ? t("goalForm.editTitle") : t("goalForm.newTitle")}
          </Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("common.close")} hitSlop={6}
            onPress={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-noche-2 items-center justify-center"
          >
            <X size={16} color={colorScheme === "dark" ? "#94a3b8" : "#475569"} />
          </TouchableOpacity>
        </View>
        <View className="gap-4">
          <View>
            <Text className="text-xs font-semibold text-slate-600 dark:text-slate-200 mb-1.5">{t("goalForm.nameLabel")}</Text>
            <TextInput
              disableFullscreenUI              value={name}
              onChangeText={setName}
              onFocus={() => onFieldFocus("name")}
              onBlur={() => onFieldBlur("name")}
              placeholder={t("goalForm.namePlaceholder")}
              placeholderTextColor="#94a3b8"
              className="w-full bg-slate-50 dark:bg-noche-2 rounded-xl border-[1.5px] border-slate-200 dark:border-noche-borde px-4 py-3.5 text-sm font-semibold text-slate-900 dark:text-slate-100"
            />
          </View>
          <View className="flex-row gap-3">
          <View className="flex-1 min-w-0">
            <Text className="text-xs font-semibold text-slate-600 dark:text-slate-200 mb-1.5">{t("goalForm.targetLabel")}</Text>
            <View className="flex-row items-center bg-slate-50 dark:bg-noche-2 rounded-xl border-[1.5px] border-slate-200 dark:border-noche-borde px-4 py-3.5">
              <Text className="text-slate-500 dark:text-slate-300 font-bold mr-1">{currencySymbolFor(userCurrency)}</Text>
              <TextInput
                disableFullscreenUI                keyboardType="decimal-pad"
                value={target}
                onChangeText={(v) => setTarget(sanitizeAmountInput(v, userCurrency))}
                onFocus={() => onFieldFocus("target")}
                onBlur={() => onFieldBlur("target")}
                placeholder="0.00"
                placeholderTextColor="#94a3b8"
                className="flex-1 text-lg font-extrabold text-slate-900 dark:text-slate-100"
              />
            </View>
          </View>
          {goal && <View className="flex-1 min-w-0">
            <Text className="text-xs font-semibold text-slate-600 dark:text-slate-200 mb-1.5">{t("savingsDetail.saved")}</Text>
            <View className="flex-row items-center rounded-xl border-[1.5px] border-slate-200 bg-slate-50 px-4 py-3.5 dark:border-noche-borde dark:bg-noche-2">
              <Text className="mr-1 font-bold text-slate-500 dark:text-slate-300">{currencySymbolFor(userCurrency)}</Text>
              <TextInput disableFullscreenUI accessibilityLabel={t("savingsDetail.saved")} value={saved} keyboardType="decimal-pad"
                onChangeText={value => setSaved(sanitizeAmountInput(value, userCurrency))} onFocus={() => onFieldFocus("saved")} onBlur={() => onFieldBlur("saved")}
                placeholder="0.00" placeholderTextColor="#94a3b8" className="min-w-0 flex-1 text-lg font-extrabold text-slate-900 dark:text-slate-100" />
            </View>
          </View>}
          </View>
          {!goal && <View>
            <Text className="text-xs font-semibold text-slate-600 dark:text-slate-200 mb-1.5">{t("savings.initial")}</Text>
            <TextInput disableFullscreenUI accessibilityLabel={t("savings.initial")} value={initial} keyboardType="decimal-pad" onChangeText={v => setInitial(sanitizeAmountInput(v, userCurrency))}
              onFocus={() => onFieldFocus("initial")} onBlur={() => onFieldBlur("initial")} placeholder="0.00" placeholderTextColor="#94a3b8"
              className="rounded-xl border-[1.5px] border-slate-200 bg-slate-50 px-4 py-3 text-base font-bold text-slate-900 dark:border-noche-borde dark:bg-noche-2 dark:text-slate-100" />
            <Text className="mt-1.5 text-xs text-slate-500 dark:text-slate-300">{t("savings.initialHelp")}</Text>
            <Text className={`mt-2 text-xs ${initialAmount > maximoAApartar ? "text-rose-500" : "text-slate-500 dark:text-slate-300"}`}>{t("savings.previewPersonal", { amount: fmt(libre - initialAmount) })}</Text>
            {initialError && <Text className="mt-1 text-xs text-rose-500">{t(initialError === "tooLarge" ? "toast.amountTooLarge" : "toast.amountDecimals")}</Text>}
          </View>}
          {goal && <View className="rounded-xl bg-violet-50 p-3 dark:bg-violet-950">
            {stale && <Text className="mb-2 text-xs font-bold text-rose-500">{t("savings.reopenGoal")}</Text>}
            {delta !== 0 && <Text className="mb-1 text-xs font-semibold text-violet-700 dark:text-violet-200">{t(delta > 0 ? "savings.editAdd" : "savings.editReturn", { amount: fmt(Math.abs(delta)) })}</Text>}
            <Text className="text-xs text-slate-600 dark:text-slate-200">{t("savings.previewPersonal", { amount: fmt(libre - delta) })}</Text>
            {savedError && <Text className="mt-1 text-xs text-rose-500">{t(savedError === "tooLarge" ? "toast.amountTooLarge" : "toast.amountDecimals")}</Text>}
            {delta > maximoAApartar && <Text className="mt-1 text-xs text-rose-500">{t("moveMoney.overFree", { amount: fmt(maximoAApartar) })}</Text>}
          </View>}
        </View>
        <View className="flex-row gap-3 mt-6">
          <TouchableOpacity onPress={onClose} className="flex-1 py-3.5 rounded-2xl bg-slate-100 dark:bg-noche-2 items-center">
            <Text className="font-bold text-slate-600 dark:text-slate-200">{t("common.cancel")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            disabled={!valid || guardando}
            onPress={async () => {
              if (saveLock.current) return;
              saveLock.current = true;
              setGuardando(true);
              try { await onSave(metaConEstadoActual({
                ...goal,
                id: goalId,
                name: name.trim(),
                target: parseAmountInput(target, userCurrency),
                saved: goal ? desiredSaved : 0,
                createdDate,
                completed: goal ? goal.completed : false,
              }), goal ? undefined : initialAmount, goal ? originalSaved : undefined); }
              catch { showToast(t("toast.localSaveFailed")); }
              finally { saveLock.current = false; setGuardando(false); }
            }}
            className={`flex-1 py-3.5 rounded-2xl bg-emerald-600 items-center ${!valid || guardando ? "opacity-40" : ""}`}
          >
            <Text className="font-bold text-white">{t(goal ? "savings.saveChanges" : "common.save")}</Text>
          </TouchableOpacity>
        </View>
        </ScrollView>
      </View>
    </Animated.View>
  );
}
