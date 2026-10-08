import { useState } from "react";
import { ArrowDown, ArrowUp, Check, X } from "lucide-react-native";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from "react-native";
import Modal from "@/components/PrivateModal";
import { useAppData } from "@/contexts/AppDataContext";
import { COUNTRIES } from "@/constants/countries";
import { currencySymbolFor } from "@/constants/currencies";
import { gastosDisponibles, ingresosDisponibles } from "@/constants/categories";
import SpaceMovementFields from "@/components/SpaceMovementFields";
import TransactionCategorySheet from "@/components/TransactionCategorySheet";
import { SpacePaymentMethod } from "@/components/SpaceMovementControls";

export type SpaceMovementType = "ingreso" | "gasto" | null;
export type SpaceMoneyOrigin = "externo" | "personal";

type Props = {
  visible: boolean;
  type: SpaceMovementType;
  onType: (type: Exclude<SpaceMovementType, null>) => void;
  onClose: () => void;
  onSave: () => void;
  amount: string;
  onAmount: (value: string) => void;
  description: string;
  onDescription: (value: string) => void;
  method: string;
  onMethod: (value: string) => void;
  currency: string;
  category: string;
  onCategory: (value: string) => void;
  date: string;
  onDate: (value: string) => void;
  notes: string;
  onNotes: (value: string) => void;
  origin?: SpaceMoneyOrigin;
  onOrigin?: (value: SpaceMoneyOrigin) => void;
  availableText?: string;
  disabled?: boolean;
};

export default function SpaceMovementSheet({
  visible, type, onType, onClose, onSave, amount, onAmount, description, onDescription,
  method, onMethod, currency, category, onCategory, date, onDate, notes, onNotes,
  origin, onOrigin, availableText, disabled = false,
}: Props) {
  const { t, userCountry } = useAppData();
  const [showCategories, setShowCategories] = useState(false);
  const { height } = useWindowDimensions();
  const categoryType = type === "ingreso" ? "income" : "expense";
  const categories = categoryType === "income" ? ingresosDisponibles() : gastosDisponibles();
  const flag = COUNTRIES.find(country => country.currency === currency)?.flag
    || COUNTRIES.find(country => country.id === userCountry)?.flag
    || "🌐";

  return <Modal transparent visible={visible} animationType="slide" statusBarTranslucent onRequestClose={() => {
    if (showCategories) {
      setShowCategories(false);
      return;
    }
    onClose();
  }}>
    <View className="flex-1 justify-end bg-black/45">
      <Pressable accessibilityRole="button" accessibilityLabel={t("common.cancel")} onPress={onClose} className="absolute inset-0" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="justify-end">
        <ScrollView
          className="rounded-t-[28px] bg-white px-5 dark:bg-noche"
          style={{ maxHeight: height * 0.92 }}
          contentContainerStyle={{ paddingTop: 10, paddingBottom: 20 }}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          <View className="mb-3 self-center h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-600" />
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-base font-extrabold text-slate-900 dark:text-slate-100">{t("common.addMovement")}</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("common.cancel")} disabled={disabled} onPress={onClose} className="h-9 w-9 items-center justify-center rounded-full bg-slate-100 dark:bg-noche-2">
              <X size={18} color="#64748b" />
            </TouchableOpacity>
          </View>

          <View className="mb-3 flex-row items-center gap-2">
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("boxes.income")} accessibilityState={{ selected: type === "ingreso" }} disabled={disabled} onPress={() => onType("ingreso")} className={`h-11 flex-1 flex-row items-center justify-center gap-2 rounded-xl ${type === "ingreso" ? "bg-emerald-600" : "bg-emerald-50 dark:bg-emerald-950/50"}`}>
              <ArrowUp size={19} color={type === "ingreso" ? "#fff" : "#047857"} />
              <Text className={`text-xs font-extrabold ${type === "ingreso" ? "text-white" : "text-emerald-800 dark:text-emerald-200"}`}>{t("boxes.income")}</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("boxes.expense")} accessibilityState={{ selected: type === "gasto" }} disabled={disabled} onPress={() => onType("gasto")} className={`h-11 flex-1 flex-row items-center justify-center gap-2 rounded-xl ${type === "gasto" ? "bg-rose-600" : "bg-rose-50 dark:bg-rose-950/50"}`}>
              <ArrowDown size={19} color={type === "gasto" ? "#fff" : "#be123c"} />
              <Text className={`text-xs font-extrabold ${type === "gasto" ? "text-white" : "text-rose-800 dark:text-rose-200"}`}>{t("boxes.expense")}</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("common.save")} disabled={disabled || !type} onPress={onSave} className={`h-11 w-11 items-center justify-center rounded-xl ${disabled || !type ? "bg-slate-200 dark:bg-slate-700" : "bg-emerald-600"}`}>
              <Check size={22} color={disabled || !type ? "#94a3b8" : "#fff"} strokeWidth={3} />
            </TouchableOpacity>
          </View>

          <View className="rounded-2xl border-[1.5px] border-slate-200 bg-slate-50 px-3 py-2 dark:border-noche-borde dark:bg-noche-2">
            <View className="flex-row items-center gap-2">
              <Text className="text-base">{flag}</Text>
              <Text className="text-xs font-extrabold text-slate-600 dark:text-slate-300">{currencySymbolFor(currency)} · {currency}</Text>
            </View>
            <TextInput
              disableFullscreenUI
              accessibilityLabel={t("addSheet.amount")}
              editable={!disabled}
              value={amount}
              onChangeText={onAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#94a3b8"
              className={`h-12 p-0 text-[30px] font-extrabold ${type === "gasto" ? "text-rose-600" : "text-emerald-700 dark:text-emerald-300"}`}
            />
          </View>

          <View className="mt-2 flex-row items-center gap-2">
            <TextInput disableFullscreenUI editable={!disabled} value={description} onChangeText={onDescription} maxLength={60} placeholder={t("boxes.description")} placeholderTextColor="#94a3b8" className="h-12 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 dark:border-noche-borde dark:text-slate-100" />
            {!(origin === "personal" && type === "ingreso") ? <SpacePaymentMethod value={method} onChange={onMethod} disabled={disabled} compact /> : null}
          </View>

          {origin && onOrigin && type === "ingreso" ? <View className="mt-2">
            <Text className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">{t("family.moneyOrigin")}</Text>
            <View className="flex-row gap-2">
              {(["externo", "personal"] as const).map(value => <TouchableOpacity key={value} accessibilityRole="button" accessibilityState={{ selected: origin === value }} disabled={disabled} onPress={() => onOrigin(value)} className={`min-h-9 flex-1 items-center justify-center rounded-xl border ${origin === value ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950" : "border-slate-200 dark:border-noche-borde"}`}>
                <Text className="text-xs font-bold text-slate-700 dark:text-slate-200">{t(value === "personal" ? "family.fromPersonal" : "family.externalMoney")}</Text>
              </TouchableOpacity>)}
            </View>
            {origin === "personal" && availableText ? <Text className="mt-1 text-[11px] text-slate-500">{availableText}</Text> : null}
          </View> : null}

          <SpaceMovementFields type={type} category={category} onOpenCategory={() => setShowCategories(true)} date={date} onDate={onDate} notes={notes} onNotes={onNotes} />
        </ScrollView>
      </KeyboardAvoidingView>
      {showCategories && type ? <TransactionCategorySheet
        type={categoryType}
        categories={categories}
        selectedId={category}
        onClose={() => setShowCategories(false)}
        onSelect={(id) => { onCategory(id); setShowCategories(false); }}
      /> : null}
    </View>
  </Modal>;
}
