import { useEffect, useMemo, useState } from "react";
import { Keyboard, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import { router } from "expo-router";
import { Plus } from "lucide-react-native";
import IconBadge from "@/components/IconBadge";
import { gastosDisponibles } from "@/constants/categories";
import { currencySymbolFor } from "@/constants/currencies";
import { useAppData } from "@/contexts/AppDataContext";
import { sanitizeAmountInput } from "@/utils/amount";
import { useKeyboardAnimatedPadding } from "@/utils/keyboard";
import AvisoSoloLectura from "@/components/AvisoSoloLectura";
import BackButton from "@/components/BackButton";

export default function CategoryBudgets({
  onBack,
  soloLectura = false,
}: {
  onBack: () => void;
  /** Se acabó la prueba y ya había límites puestos: se ven, pero no se cambian. */
  soloLectura?: boolean;
}) {
  const { t, fmt, userCurrency, categoryBudgets, categorySpent, updateCategoryBudgets, categoriasPropias } =
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

  function save() {
    // EL PORTERO, POR SI ALGÚN DÍA QUEDA UN BOTÓN SUELTO. Esconder el botón de guardar basta
    // hoy, pero esconder no es impedir: esta línea es la que de verdad protege el dato.
    if (soloLectura) return;
    const newBudgets: Record<string, number> = {};
    Object.entries(amounts).forEach(([id, v]) => {
      const n = parseFloat(v);
      if (n > 0) newBudgets[id] = n;
    });
    updateCategoryBudgets(newBudgets);
    onBack();
  }

  return (
    <Animated.View
      className="flex-1 bg-white dark:bg-slate-900"
      style={[{ paddingTop: insets.top }, animatedPaddingStyle]}
    >
      <View className="flex-row items-center justify-between px-5 pt-2 pb-4">
        <BackButton onPress={onBack} />
        <Text className="text-base font-bold" style={{ color: primaryTextColor }}>{t("categoryBudgets.title")}</Text>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 20 }}>
        {soloLectura && <AvisoSoloLectura />}
        <Text className="text-xs text-slate-500 dark:text-slate-300 mb-4">{t("categoryBudgets.subtitle")}</Text>
        <View className="gap-2.5">
          {categorias.map((c) => {
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
                    {/* EN SOLO LECTURA LA CASILLA SE VE Y NO SE ESCRIBE. Se deja a la vista y
                        no se esconde porque el límite es el dato: sin él, la barra de "llevas
                        X de Y" no significa nada. */}
                    <TextInput
                      value={amounts[c.id] ?? ""}
                      editable={!soloLectura}
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

          {/* CREAR UNA CATEGORÍA SIN SALIR DE AQUÍ (12/08/2026).
              Pedido suyo: *"esos iconos que tengo en elegir categoría, quiero que estén en
              presupuesto por categoría"*.
              Traer aquí el catálogo entero de dibujos habría sido copiar una pantalla de 236
              casillas dentro de otra. Se lleva a la que ya existe y sabe hacerlo —con su
              catálogo, sus colores y sus fotos— y al volver, la categoría nueva ya está en esta
              lista con su casilla, lista para ponerle el límite.
              En solo lectura no sale: crear es de las cosas que Premium sí cierra. */}
          {!soloLectura && (
            <TouchableOpacity
              onPress={() => router.push("/nueva-categoria")}
              className="flex-row items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-slate-300 dark:border-slate-600 py-4"
            >
              <Plus size={17} color="#059669" />
              <Text className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                {t("categoryBudgets.nueva")}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {!soloLectura && (
        <View
          className="px-5 py-4 border-t border-slate-200 dark:border-slate-700"
          style={{ paddingBottom: 16 + insets.bottom }}
        >
          <TouchableOpacity onPress={save} className="w-full bg-emerald-600 py-4 rounded-2xl items-center">
            <Text className="text-white font-bold">{t("common.saveChanges")}</Text>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
}
