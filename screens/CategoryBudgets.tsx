import { useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import IconBadge from "@/components/IconBadge";
import { EXPENSE_CATS } from "@/constants/categories";
import { currencySymbolFor } from "@/constants/currencies";
import { useAppData } from "@/contexts/AppDataContext";
import { sanitizeAmountInput } from "@/utils/amount";
import BackButton from "@/components/BackButton";

export default function CategoryBudgets({ onBack }: { onBack: () => void }) {
  const { t, fmt, userCurrency, categoryBudgets, categorySpent, updateCategoryBudgets } = useAppData();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const primaryTextColor = colorScheme === "dark" ? "#f1f5f9" : "#0f172a";
  const [amounts, setAmounts] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    EXPENSE_CATS.forEach((c) => {
      initial[c.id] = categoryBudgets[c.id] ? String(categoryBudgets[c.id]) : "";
    });
    return initial;
  });

  function save() {
    const newBudgets: Record<string, number> = {};
    Object.entries(amounts).forEach(([id, v]) => {
      const n = parseFloat(v);
      if (n > 0) newBudgets[id] = n;
    });
    updateCategoryBudgets(newBudgets);
    onBack();
  }

  return (
    <View className="flex-1 bg-white dark:bg-slate-900" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center justify-between px-5 pt-2 pb-4">
        <BackButton onPress={onBack} />
        <Text className="text-base font-bold" style={{ color: primaryTextColor }}>{t("categoryBudgets.title")}</Text>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 20 }}>
        <Text className="text-xs text-slate-500 dark:text-slate-300 mb-4">{t("categoryBudgets.subtitle")}</Text>
        <View className="gap-2.5">
          {EXPENSE_CATS.map((c) => {
            const limit = categoryBudgets[c.id] || 0;
            const spent = categorySpent[c.id] || 0;
            const pct = limit > 0 ? spent / limit : 0;
            const over = limit > 0 && pct >= 1;
            const barColor = over ? "#f43f5e" : pct >= 0.7 ? "#f59e0b" : "#10b981";
            return (
              <View key={c.id} className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-3 border-[1.5px] border-slate-200 dark:border-slate-700">
                <View className="flex-row items-center gap-3">
                  <IconBadge Icon={c.icon} color={c.color} size={38} image={c.image} />
                  <Text
                    className="flex-1 text-sm font-bold"
                    style={{ color: primaryTextColor }}
                    numberOfLines={1}
                  >
                    {t(c.label)}
                  </Text>
                  <View className="flex-row items-center bg-white dark:bg-slate-900 rounded-xl border-[1.5px] border-slate-200 dark:border-slate-700 px-3 py-2 w-32">
                    <Text className="text-slate-500 dark:text-slate-300 text-xs font-bold mr-1">
                      {currencySymbolFor(userCurrency)}
                    </Text>
                    <TextInput
                      value={amounts[c.id]}
                      onChangeText={(v) =>
                        setAmounts((prev) => ({ ...prev, [c.id]: sanitizeAmountInput(v) }))
                      }
                      keyboardType="decimal-pad"
                      placeholder={t("categoryBudgets.noLimit")}
                      placeholderTextColor="#94a3b8"
                      className="flex-1 text-sm font-bold"
                      style={{ color: primaryTextColor }}
                    />
                  </View>
                </View>
                {limit > 0 ? (
                  <View className="mt-2.5 pl-[50px]">
                    <View className="flex-row items-center justify-between mb-1">
                      <Text className={`text-[11px] font-bold ${over ? "text-rose-500" : "text-slate-500 dark:text-slate-300"}`}>
                        {t("categoryBudgets.spentOfLimit", { spent: fmt(spent), limit: fmt(limit) })}
                      </Text>
                    </View>
                    <View className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <View
                        className="h-1.5 rounded-full"
                        style={{ width: `${Math.min(pct, 1) * 100}%`, backgroundColor: barColor }}
                      />
                    </View>
                    {over ? (
                      <Text className="text-[11px] text-rose-500 font-medium mt-1">
                        {t("categoryBudgets.overBudget")}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View
        className="px-5 py-4 border-t border-slate-200 dark:border-slate-700"
        style={{ paddingBottom: 16 + insets.bottom }}
      >
        <TouchableOpacity onPress={save} className="w-full bg-emerald-600 py-4 rounded-2xl items-center">
          <Text className="text-white font-bold">{t("common.saveChanges")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
