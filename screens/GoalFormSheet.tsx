import { useEffect, useState } from "react";
import { Keyboard, Text, TextInput, TouchableOpacity, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { nextId } from "@/utils/id";
import { sanitizeAmountInput } from "@/utils/amount";
import { useKeyboardAnimatedPadding } from "@/utils/keyboard";
import { fmtDate } from "@/utils/format";
import { currencySymbolFor } from "@/constants/currencies";
import { useAppData } from "@/contexts/AppDataContext";
import type { Goal } from "@/types";
import { useColorScheme } from "nativewind";

export default function GoalFormSheet({
  goal,
  onClose,
  onSave,
}: {
  goal?: Goal;
  onClose: () => void;
  onSave: (g: Goal) => void;
}) {
  const { userCurrency, t, monthNames } = useAppData();
  const [name, setName] = useState(goal?.name || "");
  const [target, setTarget] = useState(goal ? String(goal.target) : "");
  const valid = name.trim().length > 0 && parseFloat(target) > 0;
  const createdDate = goal?.createdDate || new Date().toISOString().slice(0, 10);
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
      <TouchableOpacity className="absolute inset-0 bg-slate-900/40" activeOpacity={1} onPress={onClose} />
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
        <View className="flex-row items-center justify-between mb-4">
          <Text className="font-extrabold text-slate-900 dark:text-slate-100 text-base">
            {goal ? t("goalForm.editTitle") : t("goalForm.newTitle")}
          </Text>
          <TouchableOpacity
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
          <View>
            <Text className="text-xs font-semibold text-slate-600 dark:text-slate-200 mb-1.5">{t("goalForm.targetLabel")}</Text>
            <View className="flex-row items-center bg-slate-50 dark:bg-noche-2 rounded-xl border-[1.5px] border-slate-200 dark:border-noche-borde px-4 py-3.5">
              <Text className="text-slate-500 dark:text-slate-300 font-bold mr-1">{currencySymbolFor(userCurrency)}</Text>
              <TextInput
                disableFullscreenUI                keyboardType="decimal-pad"
                value={target}
                onChangeText={(v) => setTarget(sanitizeAmountInput(v))}
                onFocus={() => onFieldFocus("target")}
                onBlur={() => onFieldBlur("target")}
                placeholder="0.00"
                placeholderTextColor="#94a3b8"
                className="flex-1 text-lg font-extrabold text-slate-900 dark:text-slate-100"
              />
            </View>
          </View>
          <Text className="text-[11px] text-slate-500 dark:text-slate-300 px-1">
            {t("goalForm.createdLabel", { date: fmtDate(createdDate, monthNames) })}
          </Text>
        </View>
        <View className="flex-row gap-3 mt-6">
          <TouchableOpacity onPress={onClose} className="flex-1 py-3.5 rounded-2xl bg-slate-100 dark:bg-noche-2 items-center">
            <Text className="font-bold text-slate-600 dark:text-slate-200">{t("common.cancel")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            disabled={!valid}
            onPress={() =>
              onSave({
                id: goal?.id || nextId(),
                name: name.trim(),
                target: parseFloat(target),
                saved: goal?.saved || 0,
                createdDate,
                completed: goal ? goal.completed : false,
              })
            }
            className={`flex-1 py-3.5 rounded-2xl bg-emerald-600 items-center ${!valid ? "opacity-40" : ""}`}
          >
            <Text className="font-bold text-white">{t("common.save")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}
