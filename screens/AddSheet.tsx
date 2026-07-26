import { useEffect, useRef, useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X, Check, ChevronDown, ChevronUp, Calendar } from "lucide-react-native";
import { EXPENSE_CATS, INCOME_CATS } from "@/constants/categories";
import { currencySymbolFor } from "@/constants/currencies";
import { methodLabel, PAYMENT_METHODS } from "@/constants/i18n";
import { useAppData } from "@/contexts/AppDataContext";
import { defaultDateForMonth, isValidISODate, normalizeDateInput } from "@/utils/date";
import { parseAmountInput, sanitizeAmountInput } from "@/utils/amount";
import { useKeyboardAnimatedPadding } from "@/utils/keyboard";
import { nextId } from "@/utils/id";
import type { Month, Transaction } from "@/types";
import { useColorScheme } from "nativewind";

// Alto compartido por las cajas de Fecha y Método de pago, para que se vean
// exactamente iguales en cualquier celular.
const FIELD_HEIGHT = 48;

export default function AddSheet({
  initialType,
  transaction,
  currentMonth,
  onClose,
  onSave,
}: {
  initialType?: "expense" | "income";
  transaction?: Transaction;
  currentMonth: Month;
  onClose: () => void;
  onSave: (t: Transaction) => void;
}) {
  const { userCurrency, t } = useAppData();
  const [type, setType] = useState<"expense" | "income">(
    initialType || transaction?.type || "expense"
  );
  const [amount, setAmount] = useState(transaction ? String(transaction.amount) : "");
  const [category, setCategory] = useState(
    transaction?.category || (type === "expense" ? "comida" : "salario")
  );
  const [date, setDate] = useState(transaction?.date || defaultDateForMonth(currentMonth));
  const [method, setMethod] = useState(transaction?.method || "debit");
  const [description, setDescription] = useState(transaction?.description || "");
  const [notes, setNotes] = useState(transaction?.notes || "");
  const [showMethod, setShowMethod] = useState(false);
  const [showAllCats, setShowAllCats] = useState(false);
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const { colorScheme } = useColorScheme();

  const cats = type === "expense" ? EXPENSE_CATS : INCOME_CATS;

  useEffect(() => {
    if (!transaction) {
      setCategory(type === "expense" ? "comida" : "salario");
      setShowAllCats(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  // Guardar exige monto positivo Y fecha real. Antes solo se miraba el
  // monto, así que una fecha escrita a mano de cualquier forma se guardaba
  // igual y rompía la app al mostrarla.
  const dateOk = isValidISODate(date);
  const valid = parseAmountInput(amount) > 0 && dateOk;

  // El hueco del teclado lo entrega Reanimated, sincronizado con la
  // animación nativa del teclado (ver utils/keyboard.ts). Ya no depende de
  // avisos de JavaScript que Android podía saltarse al cambiar de campo.
  const { animatedPaddingStyle, keyboardVisible } = useKeyboardAnimatedPadding();

  function focusField() {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
  }

  return (
    // Pantalla COMPLETA, no un panel flotante.
    //
    // Antes era una hoja pegada abajo dentro de una pantalla transparente, y
    // eso obligaba a calcular su altura contra el teclado. Ocupando toda la
    // pantalla el reparto lo hace flexbox solo: cabecera arriba, campos en
    // medio (con scroll) y botones abajo. Nada puede desbordarse.
    //
    // El Animated.View exterior cubre la pantalla con "position: absolute,
    // inset 0" —NO con "flex: 1"— y lleva solo el padding animado (mismo
    // patrón que PressableScale.tsx: la animación en un envoltorio propio,
    // las clases de Tailwind en el View de dentro).
    //
    // Por qué NO flex:1: esta pantalla ahora se presenta como
    // "transparentModal" (para evitar el destello blanco al abrirla). Ese
    // tipo de presentación no siempre le da a su contenido una altura
    // definida — "flex: 1" necesita que ALGÚN ancestro tenga un alto
    // concreto para saber qué significa "llenar el espacio". Sin eso, el
    // contenido se encogía a lo que ocupaba (cabecera + campos + botones)
    // y el resto de la pantalla, al ser el modal transparente, dejaba ver
    // Inicio por debajo — que es justo lo que apareció después de guardar
    // un movimiento y abrir uno nuevo.
    //
    // "position: absolute, inset 0" no depende de que nadie le dé una
    // altura: siempre cubre el dispositivo entero, sea cual sea el tipo de
    // presentación. Es el mismo recurso que ya usa AddChooser.tsx.
    <Animated.View
      style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }, animatedPaddingStyle]}
    >
      <View className="flex-1 bg-white dark:bg-slate-900" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center justify-between px-5 pt-2 pb-3">
        <Text
          className="font-extrabold text-lg"
          style={{ color: colorScheme === "dark" ? "#f1f5f9" : "#0f172a" }}
        >
          {transaction ? t("addSheet.editTitle") : t("addSheet.newTitle")}
        </Text>
        <TouchableOpacity
          onPress={onClose}
          className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 items-center justify-center"
        >
          <X size={16} color={colorScheme === "dark" ? "#94a3b8" : "#475569"} />
        </TouchableOpacity>
      </View>

      {!transaction && (
        <View className="px-5 mb-3">
          <View className="bg-slate-100 dark:bg-slate-800 rounded-xl p-1 flex-row">
            {(["expense", "income"] as const).map((opt) => (
              <TouchableOpacity
                key={opt}
                onPress={() => setType(opt)}
                className={`flex-1 py-2.5 rounded-xl items-center ${
                  type === opt ? (opt === "expense" ? "bg-rose-500" : "bg-emerald-600") : ""
                }`}
              >
                <Text className={`text-sm font-bold ${type === opt ? "text-white" : "text-slate-500 dark:text-slate-300"}`}>
                  {opt === "expense" ? t("addSheet.expense") : t("addSheet.income")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* flex-1: los campos ocupan todo el espacio que quede entre la
          cabecera y los botones, y hacen scroll dentro si no caben. Ahora
          funciona porque el padre SÍ tiene altura definida (la pantalla
          entera); antes, al ser un panel de altura variable, no podía. */}
      <ScrollView
        ref={scrollRef}
        className="flex-1 px-5"
        contentContainerClassName="gap-4 pb-5"
        keyboardShouldPersistTaps="handled"
      >
          <View>
            <Text className="text-xs font-semibold text-slate-600 dark:text-slate-200 mb-1.5">{t("addSheet.amount")}</Text>
            <View className="flex-row items-center bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800 px-4 py-3.5">
              <Text className="text-slate-500 dark:text-slate-300 font-bold mr-1">{currencySymbolFor(userCurrency)}</Text>
              <TextInput
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={(v) => setAmount(sanitizeAmountInput(v))}
                placeholder="0.00"
                placeholderTextColor="#94a3b8"
                className="flex-1 text-lg font-extrabold"
                style={{ color: colorScheme === "dark" ? "#f1f5f9" : "#0f172a" }}
              />
            </View>
          </View>

          <View>
            <View className="flex-row items-center justify-between mb-1.5">
              <Text className="text-xs font-semibold text-slate-600 dark:text-slate-200">{t("detail.category")}</Text>
              <Text className="text-[11px] font-semibold text-slate-500 dark:text-slate-300">
                {t(cats.find((c) => c.id === category)?.label ?? "")}
              </Text>
            </View>
            <View className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-3xl p-3">
              <View className="flex-row flex-wrap gap-3">
                {cats
                  .filter((c) => showAllCats || !c.extra)
                  .map((c) => {
                    const active = category === c.id;
                    return (
                      <TouchableOpacity
                        key={c.id}
                        onPress={() => setCategory(c.id)}
                        className="items-center gap-1.5"
                        style={{ width: "21%" }}
                      >
                        <View
                          className={`w-12 h-12 rounded-2xl items-center justify-center bg-${c.color}-100 ${
                            active ? `border-2 border-${c.color}-500` : ""
                          }`}
                        >
                          <Text style={{ fontSize: 20 }}>{c.emoji}</Text>
                        </View>
                        <Text
                          className={`text-xs font-bold text-center ${
                            active ? `text-${c.color}-600` : "text-slate-600 dark:text-slate-200"
                          }`}
                          numberOfLines={1}
                        >
                          {t(c.label)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                {cats.some((c) => c.extra) && (
                  <TouchableOpacity
                    onPress={() => setShowAllCats((v) => !v)}
                    className="items-center gap-1.5"
                    style={{ width: "21%" }}
                  >
                    <View className="w-12 h-12 rounded-2xl items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-600">
                      {showAllCats ? (
                        <ChevronUp size={18} color="#94a3b8" />
                      ) : (
                        <ChevronDown size={18} color="#94a3b8" />
                      )}
                    </View>
                    <Text className="text-xs font-bold text-center text-slate-500 dark:text-slate-300">
                      {showAllCats ? t("addSheet.seeLess") : t("addSheet.seeMore")}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          {/* Fecha y Método comparten FIELD_HEIGHT. Sin esa altura fija se
              veían de distinto tamaño: en Android un campo de escritura trae
              relleno propio invisible que un texto normal no tiene, así que
              el mismo py- daba dos alturas distintas. */}
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Text className="text-xs font-semibold text-slate-600 dark:text-slate-200 mb-1.5">{t("detail.date")}</Text>
              <View
                className={`flex-row items-center gap-2 bg-slate-50 dark:bg-slate-800 rounded-xl border px-3 ${
                  dateOk ? "border-slate-100 dark:border-slate-800" : "border-rose-400"
                }`}
                style={{ height: FIELD_HEIGHT }}
              >
                <Calendar size={16} color={dateOk ? "#94a3b8" : "#fb7185"} />
                <TextInput
                  value={date}
                  onChangeText={setDate}
                  // Al salir del campo se acomoda sola: si escribiste
                  // "24/07/2026" queda como la app la guarda internamente,
                  // en vez de rechazarte algo que estaba bien escrito.
                  onBlur={() => setDate((d) => normalizeDateInput(d))}
                  placeholder="AAAA-MM-DD"
                  placeholderTextColor="#94a3b8"
                  className="text-sm font-semibold flex-1"
                  // padding 0 quita el relleno propio de Android; sin esto la
                  // caja crece por dentro y no coincide con la de al lado.
                  style={{ padding: 0, color: colorScheme === "dark" ? "#f1f5f9" : "#0f172a" }}
                />
              </View>
              {!dateOk && (
                <Text className="text-[11px] font-semibold text-rose-500 mt-1">{t("addSheet.dateError")}</Text>
              )}
            </View>
            <View className="flex-1">
              <Text className="text-xs font-semibold text-slate-600 dark:text-slate-200 mb-1.5">{t("detail.method")}</Text>
              <TouchableOpacity
                onPress={() => setShowMethod(true)}
                className="flex-row items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800 px-3"
                style={{ height: FIELD_HEIGHT }}
              >
                <Text
                  className="text-sm font-semibold flex-1"
                  style={{ color: colorScheme === "dark" ? "#f1f5f9" : "#0f172a" }}
                  numberOfLines={1}
                >
                  {methodLabel(method, t)}
                </Text>
                <ChevronDown size={15} color="#94a3b8" />
              </TouchableOpacity>
            </View>
          </View>

          <View>
            <Text className="text-xs font-semibold text-slate-600 dark:text-slate-200 mb-1.5">{t("addSheet.description")}</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              onFocus={focusField}
              placeholder={t("addSheet.descriptionPlaceholder")}
              placeholderTextColor="#94a3b8"
              className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800 px-4 py-3.5 text-sm"
              style={{ color: colorScheme === "dark" ? "#f1f5f9" : "#0f172a" }}
            />
          </View>
          <View>
            <Text className="text-xs font-semibold text-slate-600 dark:text-slate-200 mb-1.5">{t("addSheet.notesOptional")}</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              onFocus={focusField}
              placeholder={t("addSheet.notesPlaceholder")}
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={2}
              className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800 px-4 py-3 text-sm"
              style={{ textAlignVertical: "top", color: colorScheme === "dark" ? "#f1f5f9" : "#0f172a" }}
            />
          </View>
      </ScrollView>

      {/* Botones fijos abajo. Quedan flotando justo encima del teclado
          porque el contenedor ya descontó lo que este ocupa. Cuando no hay
          teclado se respeta la barra de navegación del sistema. */}
      <View
        className="px-5 py-4 flex-row gap-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900"
        style={{ paddingBottom: keyboardVisible ? 16 : 16 + insets.bottom }}
      >
          <TouchableOpacity onPress={onClose} className="flex-1 py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 items-center">
            <Text className="font-bold text-slate-600 dark:text-slate-200">{t("common.cancel")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            disabled={!valid}
            onPress={() =>
              onSave({
                // Conserva los campos que esta pantalla no edita: de dónde
                // vino el movimiento, el comercio, la cuenta, el código de
                // operación y las etiquetas.
                //
                // Sin esto, editar un movimiento traído del banco lo dejaba
                // como si lo hubieras escrito a mano: perdía su insignia de
                // "Importado" y los datos con los que el detector de
                // duplicados evita registrar dos veces el mismo gasto.
                ...transaction,
                id: transaction?.id || nextId(),
                type,
                amount: parseAmountInput(amount),
                category,
                date,
                method,
                description,
                notes,
              })
            }
            className={`flex-1 py-3.5 rounded-2xl items-center ${
              type === "expense" ? "bg-rose-500" : "bg-emerald-600"
            } ${!valid ? "opacity-40" : ""}`}
          >
          <Text className="font-bold text-white">{t("common.save")}</Text>
        </TouchableOpacity>
      </View>
      </View>

      {/* Selector de método de pago.
          Va aquí fuera, encima de todo, y NO dentro de la lista con scroll.
          Cuando estaba dentro, Android recortaba lo que sobresalía de esa
          zona: solo se veían 4 de los 6 métodos y era imposible llegar a
          Yape y Plin por mucho que se arrastrara. */}
      {showMethod && (
        <View className="absolute inset-0 z-50 items-center justify-center px-8">
          <TouchableOpacity
            className="absolute inset-0 bg-slate-900/60"
            activeOpacity={1}
            onPress={() => setShowMethod(false)}
          />
          <View className="w-full bg-white dark:bg-slate-900 rounded-2xl p-2 border border-slate-100 dark:border-slate-800">
            <Text className="text-xs font-bold text-slate-500 dark:text-slate-300 px-3 pt-2 pb-1">
              {t("detail.method")}
            </Text>
            {PAYMENT_METHODS.map((m) => {
              const active = m.id === method;
              return (
                <TouchableOpacity
                  key={m.id}
                  onPress={() => {
                    setMethod(m.id);
                    setShowMethod(false);
                  }}
                  className={`w-full px-3 py-3.5 rounded-xl flex-row items-center justify-between ${
                    active ? "bg-slate-100 dark:bg-slate-800" : ""
                  }`}
                >
                  <Text
                    className={`text-sm ${
                      active
                        ? "font-extrabold text-emerald-600 dark:text-emerald-400"
                        : "font-medium text-slate-700 dark:text-slate-200"
                    }`}
                  >
                    {t(m.labelKey)}
                  </Text>
                  {active && <Check size={16} color="#059669" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </Animated.View>
  );
}
