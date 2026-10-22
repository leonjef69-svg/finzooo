import { useEffect, useMemo, useState } from "react";
import { Keyboard, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import { Plus } from "lucide-react-native";
import IconBadge from "@/components/IconBadge";
import { gastosDisponibles } from "@/constants/categories";
import { COLOR_HEX_600 } from "@/constants/colors";
import { CARD_SHADOW } from "@/constants/style";
import { currencySymbolFor } from "@/constants/currencies";
import { useAppData } from "@/contexts/AppDataContext";
import { amountInputError, parseAmountInput, sanitizeSafeAmountInput } from "@/utils/amount";
import { useKeyboardAnimatedPadding } from "@/utils/keyboard";
import BackButton from "@/components/BackButton";
import TransactionCategorySheet from "@/components/TransactionCategorySheet";

export default function CategoryBudgets({
  onBack,
}: {
  onBack: () => void;
}) {
  const { t, fmt, userCurrency, showToast, categoryBudgets, categorySpent, updateCategoryBudgets, categoriasPropias } =
    useAppData();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const primaryTextColor = colorScheme === "dark" ? "#f1f5f9" : "#0f172a";
  /**
   * EL BOTÓN DE GUARDAR, ENCIMA DEL TECLADO (12/08/2026).
   *
   * Pedido suyo con la pantalla en la mano. Al tocar una casilla, el teclado tapaba "Guardar
   * cambios": había que escribir el monto, CERRAR el teclado y recién ahí guardar. Y quien no
   * sabía eso pensaba que el botón no estaba, o guardaba a medias.
   *
   * Es el mismo hueco que ya tenía "Nuevo movimiento" y que se resolvió ahí — por eso se usa la
   * MISMA pieza y no una copia: el alto del teclado lo entrega Reanimated, sin pasar por los
   * avisos de Android que llegaban tarde y hacían saltar la pantalla.
   */
  const { animatedPaddingStyle } = useKeyboardAnimatedPadding();

  // Y SE CIERRA EL TECLADO AL SALIR. Es la otra mitad del arreglo del hueco fantasma: si esta
  // pantalla se va con el teclado abierto, la SIGUIENTE hereda ese estado. El guardia de
  // utils/keyboard ya lo tapa, pero las dos capas juntas son las que dejan el hueco en cero.
  useEffect(() => {
    return () => {
      Keyboard.dismiss();
    };
  }, []);

  /**
   * LAS SUYAS TAMBIÉN, NO SOLO LAS DE FÁBRICA (12/08/2026).
   *
   * Preguntado por él: *"en presupuesto por categorías solo hay unos pocos iconos; ¿si alguien
   * quiere elegir alguno que no está ahí?"*.
   *
   * Y faltaba algo de verdad. Esta pantalla listaba EXPENSE_CATS —las trece de fábrica—
   * mientras que anotar un gasto ofrece esas MÁS las que la persona se haya creado. Así que
   * alguien podía crear "Broster", gastar ahí todos los días, y no poder ponerle un límite: la
   * categoría existía para gastar y no para controlar. Justo al revés de para lo que uno se
   * crea una categoría propia.
   *
   * Es el fallo de siempre en este proyecto: dos listas que tenían que ser la misma.
   *
   * SE REHACE AL VOLVER DE CREAR UNA. Sin mirar categoriasPropias, la que se acaba de crear no
   * aparecería hasta cerrar y abrir la pantalla — y desde aquí mismo se crea.
   */
  const categorias = useMemo(
    () => gastosDisponibles(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categoriasPropias]
  );
  const [amounts, setAmounts] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    categorias.forEach((c) => {
      initial[c.id] = categoryBudgets[c.id] ? String(categoryBudgets[c.id]) : "";
    });
    return initial;
  });
  const [showCategories, setShowCategories] = useState(false);

  function save() {
    const issue = Object.values(amounts).map((value) => amountInputError(value, userCurrency)).find(Boolean);
    if (issue) { showToast(t(issue === "tooLarge" ? "toast.amountTooLarge" : "toast.amountDecimals")); return; }
    const newBudgets: Record<string, number> = {};
    Object.entries(amounts).forEach(([id, v]) => {
      const n = parseAmountInput(v, userCurrency);
      if (n > 0) newBudgets[id] = n;
    });
    updateCategoryBudgets(newBudgets);
    onBack();
  }

  return (
    <Animated.View
      className="flex-1 bg-white dark:bg-noche"
      style={[{ paddingTop: insets.top }, animatedPaddingStyle]}
    >
      <View className="flex-row items-center justify-between px-5 pt-2 pb-4">
        <BackButton onPress={onBack} />
        <Text className="text-base font-bold" style={{ color: primaryTextColor }}>{t("categoryBudgets.title")}</Text>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
        <Text className="text-xs text-slate-500 dark:text-slate-300 mb-4">{t("categoryBudgets.subtitle")}</Text>
        <View className="gap-3">
          {categorias.map((c) => {
            const limit = categoryBudgets[c.id] || 0;
            const spent = categorySpent[c.id] || 0;
            const pct = limit > 0 ? spent / limit : 0;
            const over = limit > 0 && spent > limit;
            const atLimit = limit > 0 && spent === limit;
            const barColor = COLOR_HEX_600[c.color] || "#10b981";
            const percentText = limit > 0
              ? pct > 999
                ? t("categoryBudgets.usedPercentMoreThan999")
                : t("categoryBudgets.usedPercent", { percent: String(Math.round(pct * 100)) })
              : null;
            return (
              /* Diseño compacto: categoría y gasto arriba; límite editable a la izquierda
                 y porcentaje a la derecha. Se conserva el mismo campo de límite y guardado. */
              <View
                key={c.id}
                testID={`category-budget-row-${c.id}`}
                className="bg-white dark:bg-noche-2 rounded-2xl p-3 border-[1.5px] border-slate-200 dark:border-noche-borde"
                style={CARD_SHADOW}
              >
                <View className="flex-row items-center gap-2.5">
                  <IconBadge Icon={c.icon} color={c.color} size={38} image={c.image} />
                  <View className="flex-1 min-w-0 gap-1.5">
                    <View className="flex-row items-start justify-between gap-2">
                      <Text
                        className="flex-1 min-w-0 text-sm font-bold"
                        style={{ color: primaryTextColor }}
                        numberOfLines={1}
                      >
                        {t(c.label)}
                      </Text>
                      <Text
                        testID={`category-budget-spent-${c.id}`}
                        className={`shrink-0 max-w-[150px] text-right text-sm font-bold ${over ? "text-rose-600 dark:text-rose-400" : ""}`}
                        style={over ? undefined : { color: primaryTextColor }}
                        numberOfLines={2}
                      >
                        {fmt(spent)}
                      </Text>
                    </View>

                    <View className="flex-row items-center justify-between gap-2">
                      <View className="flex-1 min-w-0 flex-row items-center">
                        <Text className="text-[11px] text-slate-500 dark:text-slate-300 mr-1">
                          {t("categoryBudgets.limit")}
                        </Text>
                        <Text className="text-[11px] text-slate-500 dark:text-slate-300 mr-1">
                          {currencySymbolFor(userCurrency)}
                        </Text>
                        <TextInput
                          testID={`category-budget-limit-${c.id}`}
                          accessibilityLabel={t("categoryBudgets.limitFor", { category: t(c.label) })}
                          disableFullscreenUI
                          value={amounts[c.id] ?? ""}
                          onChangeText={(v) =>
                            setAmounts((prev) => ({ ...prev, [c.id]: sanitizeSafeAmountInput(v, userCurrency) }))
                          }
                          keyboardType="decimal-pad"
                          placeholder={t("categoryBudgets.noLimit")}
                          placeholderTextColor="#94a3b8"
                          className="min-w-0 max-w-[108px] flex-1 text-xs font-bold"
                          style={{ color: primaryTextColor, padding: 0 }}
                        />
                      </View>
                      {percentText ? (
                        <Text
                          testID={`category-budget-percent-${c.id}`}
                          className={`shrink-0 max-w-[112px] text-right text-[11px] font-bold ${over ? "text-rose-600 dark:text-rose-400" : atLimit ? "text-amber-600 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"}`}
                          numberOfLines={2}
                        >
                          {percentText}
                        </Text>
                      ) : null}
                    </View>

                    {limit > 0 ? (
                      <View
                        testID={`category-budget-progress-${c.id}`}
                        accessibilityLabel={percentText ?? undefined}
                        className="h-2 rounded-full bg-slate-200 dark:bg-noche-3 overflow-hidden mt-0.5"
                      >
                        <View
                          testID={`category-budget-progress-fill-${c.id}`}
                          className="h-2 rounded-full"
                          style={{ width: `${Math.max(0, Math.min(pct, 1)) * 100}%`, backgroundColor: barColor }}
                        />
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>
            );
          })}

          {/* CREAR UNA CATEGORÍA SIN SALIR DE AQUÍ (12/08/2026).
              Pedido suyo: *"esos iconos que tengo en elegir categoría, quiero que estén en
              presupuesto por categoría"*.
              Traer aquí el catálogo entero de dibujos habría sido copiar una pantalla de 236
              casillas dentro de otra. Se lleva a la que ya existe y sabe hacerlo —con su
              catálogo, sus colores y sus fotos— y al volver, la categoría nueva ya está en esta
              lista con su casilla, lista para ponerle el límite.
              Los presupuestos por categoría son gratuitos; se puede crear la categoría aquí mismo. */}
            <TouchableOpacity
              onPress={() => setShowCategories(true)}
              className="flex-row items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-slate-300 dark:border-noche-borde py-4"
            >
              <Plus size={17} color="#059669" />
              <Text className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                {t("categoryBudgets.nueva")}
              </Text>
            </TouchableOpacity>
        </View>
      </ScrollView>

      {showCategories ? <TransactionCategorySheet
        type="expense"
        categories={categorias}
        selectedId={categorias[0]?.id ?? "otros"}
        initialCreate
        onClose={() => setShowCategories(false)}
        onSelect={(id) => {
          setAmounts((prev) => ({ ...prev, [id]: prev[id] ?? "" }));
          setShowCategories(false);
        }}
      /> : null}

      <View
          className="px-5 py-4 border-t border-slate-200 dark:border-noche-borde"
          style={{ paddingBottom: 16 + insets.bottom }}
        >
          <TouchableOpacity onPress={save} className="w-full bg-emerald-600 py-4 rounded-2xl items-center">
            <Text className="text-white font-bold">{t("common.saveChanges")}</Text>
          </TouchableOpacity>
      </View>
    </Animated.View>
  );
}
