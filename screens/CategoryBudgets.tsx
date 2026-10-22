import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Pencil, Plus, Search } from "lucide-react-native";
import { Keyboard, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import IconBadge from "@/components/IconBadge";
import TransactionCategorySheet from "@/components/TransactionCategorySheet";
import BackButton from "@/components/BackButton";
import { gastosDisponibles } from "@/constants/categories";
import { currencySymbolFor } from "@/constants/currencies";
import { useAppData } from "@/contexts/AppDataContext";
import { amountInputError, parseAmountInput, sanitizeSafeAmountInput } from "@/utils/amount";
import { useKeyboardAnimatedPadding } from "@/utils/keyboard";

export default function CategoryBudgets({ onBack }: { onBack: () => void }) {
  const {
    t, fmt, userCurrency, userLanguage, monthNames, showToast, categoryBudgets,
    categorySpent, updateCategoryBudgets, categoriasPropias,
  } = useAppData();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === "dark";
  const primaryTextColor = dark ? "#f1f5f9" : "#0f172a";
  const dividerColor = dark ? "#475569" : "#cbd5e1";
  const { animatedPaddingStyle } = useKeyboardAnimatedPadding();

  useEffect(() => () => Keyboard.dismiss(), []);

  const categories = useMemo(
    () => gastosDisponibles(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categoriasPropias],
  );
  const [amounts, setAmounts] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    categories.forEach((category) => {
      initial[category.id] = categoryBudgets[category.id] ? String(categoryBudgets[category.id]) : "";
    });
    return initial;
  });
  const [showCategories, setShowCategories] = useState(false);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filteredCategories = categories.filter((category) =>
    t(category.label).toLocaleLowerCase().includes(normalizedSearch),
  );
  const now = new Date();
  const month = monthNames[now.getMonth()] ?? "";
  const monthLabel = `${month.charAt(0).toLocaleUpperCase(userLanguage)}${month.slice(1)} ${now.getFullYear()}`;

  function save() {
    const issue = Object.values(amounts).map((value) => amountInputError(value, userCurrency)).find(Boolean);
    if (issue) {
      showToast(t(issue === "tooLarge" ? "toast.amountTooLarge" : "toast.amountDecimals"));
      return;
    }
    const newBudgets: Record<string, number> = {};
    Object.entries(amounts).forEach(([id, value]) => {
      const amount = parseAmountInput(value, userCurrency);
      if (amount > 0) newBudgets[id] = amount;
    });
    Keyboard.dismiss();
    updateCategoryBudgets(newBudgets);
    onBack();
  }

  return (
    <Animated.View
      className="flex-1 bg-white dark:bg-noche"
      style={[{ paddingTop: insets.top }, animatedPaddingStyle]}
    >
      <View className="flex-row items-center justify-between gap-2 px-4 pb-3 pt-2">
        <View className="min-w-0 flex-1 flex-row items-center gap-2">
          <BackButton onPress={onBack} />
          <View className="min-w-0 flex-1">
            <Text className="text-[17px] font-extrabold" style={{ color: primaryTextColor }} numberOfLines={1}>
              {t("categoryBudgets.title")}
            </Text>
            <Text className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-300">{monthLabel}</Text>
          </View>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t("categoryBudgets.addCategory")}
          testID="category-budget-add"
          onPress={() => setShowCategories(true)}
          className="h-10 shrink-0 flex-row items-center justify-center gap-1.5 rounded-full bg-emerald-600 px-3.5"
        >
          <Plus size={17} color="#ffffff" />
          <Text className="text-xs font-extrabold text-white">{t("categoryBudgets.addCategory")}</Text>
        </TouchableOpacity>
      </View>

      <View className="px-4 pb-2">
        <View className="h-11 flex-row items-center gap-2 rounded-full border border-slate-300 bg-white px-3 dark:border-noche-borde dark:bg-noche-2">
          <Search size={17} color={dark ? "#94a3b8" : "#64748b"} />
          <TextInput
            testID="category-budget-search"
            accessibilityLabel={t("categoryBudgets.search")}
            disableFullscreenUI
            value={search}
            onChangeText={setSearch}
            placeholder={t("categoryBudgets.search")}
            placeholderTextColor="#94a3b8"
            className="min-w-0 flex-1 text-sm text-slate-900 dark:text-slate-100"
            style={{ paddingVertical: 0 }}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      <View className="flex-row items-center justify-between px-5 pb-1.5 pt-1">
        <Text testID="category-budget-count" className="text-xs font-semibold text-slate-500 dark:text-slate-300">
          {filteredCategories.length} {t(filteredCategories.length === 1 ? "categoryBudgets.category" : "categoryBudgets.categories")}
        </Text>
        <Text className="text-xs text-slate-500 dark:text-slate-300">{t("categoryBudgets.tapToEdit")}</Text>
      </View>

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        {filteredCategories.map((category) => {
          const currentAmount = amounts[category.id] ?? "";
          const limit = parseAmountInput(currentAmount, userCurrency);
          const spent = categorySpent[category.id] || 0;
          const over = limit > 0 && spent > limit;
          const near = limit > 0 && !over && spent / limit >= 0.9;
          return (
            <View
              key={category.id}
              testID={`category-budget-row-${category.id}`}
              className="min-h-[72px] flex-row items-center gap-2.5 py-2.5"
              style={{ borderBottomColor: dividerColor, borderBottomWidth: 1.2 }}
            >
              <IconBadge Icon={category.icon} color={category.color} size={38} image={category.image} />
              <View className="min-w-0 flex-1 gap-1">
                <View className="flex-row items-start justify-between gap-2">
                  <Text className="min-w-0 flex-1 pt-0.5 text-[13px] font-bold text-slate-900 dark:text-slate-100" numberOfLines={1}>
                    {t(category.label)}
                  </Text>
                  <View className="max-w-[142px] shrink-0 items-end">
                    <Text
                      testID={`category-budget-spent-${category.id}`}
                      className={`text-right text-sm font-bold ${over ? "text-rose-600 dark:text-rose-400" : near ? "text-amber-700 dark:text-amber-400" : "text-slate-900 dark:text-slate-100"}`}
                      numberOfLines={2}
                    >
                      {fmt(spent)}
                    </Text>
                    <Text className="text-[10px] text-slate-500 dark:text-slate-400">
                      {t("categoryBudgets.spent")}
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-center justify-between gap-2">
                  {editingId === category.id ? (
                    <View className="min-h-8 min-w-[112px] flex-row items-center gap-1 rounded-lg border border-emerald-500 bg-emerald-50 px-2 dark:bg-emerald-950">
                      <Text className="text-[11px] font-semibold text-slate-500 dark:text-slate-300">{t("categoryBudgets.limit")}</Text>
                      <Text className="text-[11px] font-semibold text-slate-500 dark:text-slate-300">{currencySymbolFor(userCurrency)}</Text>
                      <TextInput
                        testID={`category-budget-limit-${category.id}`}
                        accessibilityLabel={t("categoryBudgets.limitFor", { category: t(category.label) })}
                        disableFullscreenUI
                        autoFocus
                        selectTextOnFocus
                        value={currentAmount}
                        onChangeText={(value) => setAmounts((previous) => ({
                          ...previous,
                          [category.id]: sanitizeSafeAmountInput(value, userCurrency),
                        }))}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        placeholderTextColor="#94a3b8"
                        className="min-w-0 flex-1 text-right text-xs font-bold text-slate-900 dark:text-slate-100"
                        style={{ padding: 0 }}
                      />
                    </View>
                  ) : (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={t("categoryBudgets.limitFor", { category: t(category.label) })}
                      accessibilityHint={t("categoryBudgets.tapToEdit")}
                      testID={`category-budget-edit-${category.id}`}
                      onPress={() => setEditingId(category.id)}
                      className="min-h-8 flex-row items-center gap-1.5 rounded-lg px-1 py-1"
                    >
                      <Text
                        testID={`category-budget-limit-label-${category.id}`}
                        className={`text-xs ${limit === 0 ? "text-slate-500 dark:text-slate-400" : "text-slate-600 dark:text-slate-300"}`}
                        numberOfLines={1}
                      >
                        {t("categoryBudgets.limit")} {limit > 0 ? fmt(limit) : t("categoryBudgets.noLimit")}
                      </Text>
                      <Pencil size={12} color={dark ? "#94a3b8" : "#64748b"} />
                    </TouchableOpacity>
                  )}

                  {over ? (
                    <View testID={`category-budget-status-${category.id}`} className="flex-row items-center gap-1">
                      <AlertTriangle size={12} color={dark ? "#fb7185" : "#e11d48"} />
                      <Text className="text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                        {t("categoryBudgets.overLimit")}
                      </Text>
                    </View>
                  ) : near ? (
                    <View testID={`category-budget-status-${category.id}`} className="flex-row items-center gap-1">
                      <AlertTriangle size={12} color={dark ? "#fbbf24" : "#d97706"} />
                      <Text className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                        {t("categoryBudgets.nearLimit")}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
          );
        })}
        {filteredCategories.length === 0 ? (
          <Text className="py-8 text-center text-sm text-slate-500 dark:text-slate-300">
            {t("categoryBudgets.noSearchResults")}
          </Text>
        ) : null}
      </ScrollView>

      {showCategories ? (
        <TransactionCategorySheet
          type="expense"
          categories={categories}
          selectedId={categories[0]?.id ?? "otros"}
          initialCreate
          onClose={() => setShowCategories(false)}
          onSelect={(id) => {
            setAmounts((previous) => ({ ...previous, [id]: previous[id] ?? "" }));
            setShowCategories(false);
          }}
        />
      ) : null}

      <View
        className="border-t border-slate-200 px-4 py-3 dark:border-noche-borde"
        style={{ paddingBottom: 12 + insets.bottom }}
      >
        <TouchableOpacity
          testID="category-budget-save"
          onPress={save}
          className="w-full items-center rounded-2xl bg-emerald-600 py-3.5"
        >
          <Text className="text-sm font-extrabold text-white">{t("common.saveChanges")}</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}
