import { useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import Animated, {
  KeyboardState,
  useAnimatedKeyboard,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X, Check, ChevronDown, ChevronUp, Calendar, Plus, Pencil } from "lucide-react-native";
import { router } from "expo-router";
import CategoryAvatar from "@/components/CategoryAvatar";
import { catInfo, gastosDisponibles, ingresosDisponibles } from "@/constants/categories";
import { currencySymbolFor } from "@/constants/currencies";
import { methodLabel, PAYMENT_METHODS } from "@/constants/i18n";
import { useAppData } from "@/contexts/AppDataContext";
import { defaultDateForMonth, isValidISODate, normalizeDateInput } from "@/utils/date";
import { parseAmountInput, sanitizeAmountInput } from "@/utils/amount";
import { esPropia } from "@/utils/categoriasPropias";
import { nextId } from "@/utils/id";
import { horaDe } from "@/utils/format";
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
  const { userCurrency, t, categoriasPropias, categoriaRecienCreada, olvidarCategoriaRecienCreada } =
    useAppData();
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
  const [descriptionY, setDescriptionY] = useState(0);
  const { colorScheme } = useColorScheme();

  // Las de la app MÁS las que creó la persona. Se recalcula cuando cambian:
  // sin categoriasPropias en las dependencias, la recién creada no aparecería
  // hasta salir y volver a entrar.
  const cats = useMemo(
    () => (type === "expense" ? gastosDisponibles() : ingresosDisponibles()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [type, categoriasPropias]
  );

  // Al volver de crear una categoría, se deja elegida. Nadie crea una
  // categoría para después tener que buscarla en la cuadrícula.
  useEffect(() => {
    if (!categoriaRecienCreada) return;
    setCategory(categoriaRecienCreada);
    // Las propias van al final, detrás de "Ver más": sin esto se elegiría una
    // que no se ve.
    setShowAllCats(true);
    olvidarCategoriaRecienCreada();
  }, [categoriaRecienCreada, olvidarCategoriaRecienCreada]);

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

  // ÚNICO mecanismo responsable de reaccionar al teclado en esta pantalla:
  // `useAnimatedKeyboard` (Reanimated). Se engancha directo al valor que el
  // sistema operativo empuja cuadro a cuadro cuando el teclado cambia de
  // tamaño — no depende de NINGÚN aviso de JavaScript que Android pueda
  // saltarse al cambiar de campo. Ese era el problema real de fondo de los
  // dos intentos anteriores en esta misma pantalla (KeyboardAvoidingView y
  // Keyboard.metrics() + eventos): ambos, por dentro, dependían de avisos
  // JS que Android no garantiza al saltar entre campos sin cerrar el
  // teclado — confirmado con la app real, fallaba justo ahí.
  //
  // Por qué recién ahora se puede usar: este hook necesita una pieza de
  // código nativo que Expo Go no trae — solo funciona en una development
  // build de verdad (la que se instaló en el celular). Mientras se probaba
  // dentro de Expo Go, esto simplemente no era una opción disponible.
  const keyboard = useAnimatedKeyboard();

  // El valor de useAnimatedKeyboard es COMPARTIDO por toda la app y
  // sobrevive a que esta pantalla se cierre y se vuelva a abrir. Cuando la
  // última pantalla que lo usaba se desmonta, Reanimated deja de escuchar
  // al teclado — y la siguiente que se monta arranca con el ÚLTIMO valor
  // conocido, que puede ser "abierto, 341px de alto" aunque en pantalla no
  // haya ningún teclado. Resultado: la hoja arranca con un hueco enorme
  // abajo y Descripción/Notas quedan empujados fuera de vista.
  //
  // Cerrar el teclado al salir (más abajo) no alcanza: si esta pantalla se
  // desmonta antes de que la animación de cierre termine, el último valor
  // que quedó grabado sigue siendo el de "abierto".
  //
  // ignoreStaleKeyboard resuelve eso: al montar se comprueba con
  // Keyboard.isVisible() si hay un teclado DE VERDAD en pantalla. Si no lo
  // hay, se ignora cualquier altura heredada hasta que llegue una apertura
  // real — sea porque el teclado empieza a abrirse (OPENING, detectado
  // cuadro a cuadro) o porque Android confirma que ya está abierto
  // (keyboardDidShow). A partir de ahí se vuelve a confiar en el valor
  // nativo y la animación sigue siendo igual de fluida que antes.
  const ignoreStaleKeyboard = useSharedValue(0);

  const animatedPaddingStyle = useAnimatedStyle(() => {
    if (ignoreStaleKeyboard.value === 1) return { paddingBottom: 0 };
    const state = keyboard.state.value;
    const open = state === KeyboardState.OPENING || state === KeyboardState.OPEN;
    return { paddingBottom: open ? keyboard.height.value : 0 };
  });

  // En cuanto el teclado empieza a abrirse DE VERDAD, el valor deja de ser
  // heredado y se puede volver a confiar en él.
  //
  // Dos detalles que importan y que en un primer intento estaban mal:
  //
  //  - Se ignora la PRIMERA lectura (prev === null). Esa primera lectura es
  //    exactamente el valor heredado que queremos descartar; si se actuara
  //    sobre ella, la protección se anularía a sí misma en el mismo instante
  //    de abrir la pantalla (que es justo lo que pasaba).
  //  - Solo cuenta OPENING, no OPEN. "Abierto" es el estado en el que se
  //    queda grabado el valor viejo; "abriéndose" solo puede venir de una
  //    transición real que ocurrió con esta pantalla ya montada.
  useAnimatedReaction(
    () => keyboard.state.value,
    (state, prev) => {
      if (prev === null) return;
      if (state === KeyboardState.OPENING) {
        ignoreStaleKeyboard.value = 0;
      }
    }
  );

  // keyboardVisible solo decide un detalle cosmético (cuánto margen dejar
  // bajo los botones), no la posición de nada.
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    // Al montar: si no hay un teclado real en pantalla, no confiar en el
    // valor heredado.
    const visibleNow = Keyboard.isVisible();
    ignoreStaleKeyboard.value = visibleNow ? 0 : 1;
    setKeyboardVisible(visibleNow);

    const showSub = Keyboard.addListener("keyboardDidShow", () => {
      ignoreStaleKeyboard.value = 0;
      setKeyboardVisible(true);
    });
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardVisible(false);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cierra el teclado a propósito al salir de esta pantalla (Guardar o
  // Cancelar), para que nunca quede abierto flotando sobre Inicio.
  useEffect(() => {
    return () => {
      Keyboard.dismiss();
    };
  }, []);

  // Descripción no es el último campo (Notas sí lo es), así que necesita
  // subir hasta SU propia posición (medida con onLayout) en vez de saltar
  // al final del todo. Esto es scroll de contenido, no manejo de teclado:
  // no compite con useAnimatedKeyboard/animatedPaddingStyle, que son quienes
  // deciden cuánto se achica el espacio disponible; esto solo decide QUÉ
  // PARTE de ese espacio se ve primero.
  function focusDescription() {
    setTimeout(
      () => scrollRef.current?.scrollTo({ y: Math.max(descriptionY - 16, 0), animated: true }),
      120
    );
  }

  function focusNotes() {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
  }

  // Causa real del bug de "la pantalla vuelve cortada", confirmada MIDIENDO
  // en el celular (no deducida):
  //
  //   estado=ABIERTO  alto=341  ignorar=1  →  padding=0
  //
  // O sea: el hueco NO lo ponía esta pantalla — el padding calculado era 0.
  // Lo ponía Android. El sistema seguía creyendo que el teclado estaba
  // abierto y le tenía encogida la ventana a la app justo esos 341 puntos
  // (verificado midiendo los píxeles de la captura: coincide exacto). Por
  // eso ningún ajuste dentro de React lo arreglaba: el límite estaba fuera
  // de nuestra jerarquía de vistas, a nivel del sistema operativo.
  //
  // Por qué se quedaba así: al tocar Guardar/Cancelar, el campo de texto
  // TIENE el foco. Se pide cerrar el teclado y, en el mismo instante, la
  // pantalla se destruye. Android se queda a medio esconder el teclado, con
  // la vista enfocada ya eliminada, y el espacio reservado nunca se libera.
  //
  // La corrección: pedir el cierre y ESPERAR a que Android confirme que
  // terminó (keyboardDidHide) antes de navegar. Con un tope de 400 ms por
  // si ese aviso no llegara, para no dejar la pantalla trabada nunca.
  // Cuando el teclado ya está cerrado no hay ninguna espera: se navega al
  // instante, como siempre.
  const pendingExit = useRef<{
    sub: { remove: () => void };
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);

  useEffect(() => {
    return () => {
      if (pendingExit.current) {
        pendingExit.current.sub.remove();
        clearTimeout(pendingExit.current.timer);
        pendingExit.current = null;
      }
    };
  }, []);

  function exitAfterKeyboardHidden(action: () => void) {
    if (!Keyboard.isVisible()) {
      action();
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      pendingExit.current?.sub.remove();
      if (pendingExit.current) clearTimeout(pendingExit.current.timer);
      pendingExit.current = null;
      action();
    };
    const sub = Keyboard.addListener("keyboardDidHide", finish);
    const timer = setTimeout(finish, 400);
    pendingExit.current = { sub, timer };
    Keyboard.dismiss();
  }

  function handleClose() {
    exitAfterKeyboardHidden(onClose);
  }

  function handleSave(t: Transaction) {
    exitAfterKeyboardHidden(() => onSave(t));
  }

  return (
    // Pantalla COMPLETA, no un panel flotante — cubre el dispositivo entero
    // sin importar el tipo de presentación con la que Expo Router la abra
    // (ver app/_layout.tsx). Esta View NUNCA cambia de tamaño ni de
    // posición por el teclado: es fija de principio a fin.
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
      <View className="flex-1 bg-white dark:bg-slate-900" style={{ paddingTop: insets.top }}>
        {/* Cabecera: fuera del contenedor animado a propósito, nunca se
            mueve cuando aparece el teclado. */}
        <View className="flex-row items-center justify-between px-5 pt-2 pb-3">
          <Text
            className="font-extrabold text-lg"
            style={{ color: colorScheme === "dark" ? "#f1f5f9" : "#0f172a" }}
          >
            {transaction ? t("addSheet.editTitle") : t("addSheet.newTitle")}
          </Text>
          <TouchableOpacity
            onPress={handleClose}
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

        {/* Único bloque que reacciona al teclado: campos con scroll +
            botones fijos abajo, dentro de un mismo contenedor animado cuyo
            "paddingBottom" sigue la altura real del teclado (ver
            animatedPaddingStyle arriba). Cuando el teclado aparece, este
            bloque (no la pantalla completa) se achica desde abajo — el
            ScrollView dentro se ajusta solo por ser flex:1, y los botones
            quedan pegados al borde inferior de este bloque, justo encima
            del teclado. */}
        <Animated.View style={[{ flex: 1 }, animatedPaddingStyle]}>
          <ScrollView
            ref={scrollRef}
            className="flex-1 px-5"
            contentContainerClassName="gap-4 pb-5"
            keyboardShouldPersistTaps="handled"
          >
            <View>
              <Text className="text-xs font-semibold text-slate-600 dark:text-slate-200 mb-1.5">{t("addSheet.amount")}</Text>
              <View className="flex-row items-center bg-slate-50 dark:bg-slate-800 rounded-xl border-[1.5px] border-slate-200 dark:border-slate-700 px-4 py-3.5">
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
              <View className="bg-slate-50 dark:bg-slate-800 border-[1.5px] border-slate-200 dark:border-slate-700 rounded-3xl p-3">
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
                            <CategoryAvatar id={c.id} size={20} />
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
                  {/* CREAR UNA PROPIA.
                      Va DENTRO de la cuadrícula, como una más, y no en un
                      botón aparte debajo: es donde la persona ya está mirando
                      justo cuando descubre que la suya no está. */}
                  <TouchableOpacity
                    onPress={() =>
                      router.push({ pathname: "/nueva-categoria", params: { tipo: type } })
                    }
                    className="items-center gap-1.5"
                    style={{ width: "21%" }}
                  >
                    <View className="w-12 h-12 rounded-2xl items-center justify-center border-2 border-dashed border-emerald-400">
                      <Plus size={20} color="#059669" />
                    </View>
                    <Text className="text-xs font-bold text-center text-emerald-600" numberOfLines={1}>
                      {t("nuevaCat.boton")}
                    </Text>
                  </TouchableOpacity>
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

                {/* EDITAR LA PROPIA QUE ESTÉ ELEGIDA.
                    Solo aparece con una categoría tuya seleccionada, y por eso
                    no estorba: el resto del tiempo no está. Se descarta el
                    toque largo a propósito — es invisible, y quien no lo sepa
                    no encuentra nunca cómo cambiar lo que acaba de crear. */}
                {esPropia(category) && (
                  <TouchableOpacity
                    onPress={() =>
                      router.push({ pathname: "/nueva-categoria", params: { tipo: type, id: category } })
                    }
                    className="flex-row items-center justify-center gap-1.5 mt-3 pt-3 border-t-[1.5px] border-slate-200 dark:border-slate-700"
                  >
                    <Pencil size={13} color="#64748b" />
                    <Text className="text-xs font-bold text-slate-600 dark:text-slate-200">
                      {t("nuevaCat.editarEsta", { nombre: catInfo(category).label })}
                    </Text>
                  </TouchableOpacity>
                )}
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
                  className={`flex-row items-center gap-2 bg-slate-50 dark:bg-slate-800 rounded-xl border-[1.5px] px-3 ${
                    dateOk ? "border-slate-200 dark:border-slate-700" : "border-rose-400"
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
                  className="flex-row items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800 rounded-xl border-[1.5px] border-slate-200 dark:border-slate-700 px-3"
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

            <View onLayout={(e) => setDescriptionY(e.nativeEvent.layout.y)}>
              <Text className="text-xs font-semibold text-slate-600 dark:text-slate-200 mb-1.5">{t("addSheet.description")}</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                onFocus={focusDescription}
                placeholder={t("addSheet.descriptionPlaceholder")}
                placeholderTextColor="#94a3b8"
                className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl border-[1.5px] border-slate-200 dark:border-slate-700 px-4 py-3.5 text-sm"
                style={{ color: colorScheme === "dark" ? "#f1f5f9" : "#0f172a" }}
              />
            </View>
            <View>
              <Text className="text-xs font-semibold text-slate-600 dark:text-slate-200 mb-1.5">{t("addSheet.notesOptional")}</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                onFocus={focusNotes}
                placeholder={t("addSheet.notesPlaceholder")}
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={2}
                className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl border-[1.5px] border-slate-200 dark:border-slate-700 px-4 py-3 text-sm"
                style={{ textAlignVertical: "top", color: colorScheme === "dark" ? "#f1f5f9" : "#0f172a" }}
              />
            </View>
          </ScrollView>

          {/* Botones: pegados al borde inferior de este contenedor animado.
              Cuando el teclado está abierto, insets.bottom (la barra de
              gestos del sistema) ya no hace falta —el teclado ocupa ese
              espacio— así que se omite para no dejar un hueco vacío de más. */}
          <View
            className="px-5 py-4 flex-row gap-3 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            style={{ paddingBottom: keyboardVisible ? 16 : 16 + insets.bottom }}
          >
            <TouchableOpacity onPress={handleClose} className="flex-1 py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 items-center">
              <Text className="font-bold text-slate-600 dark:text-slate-200">{t("common.cancel")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={!valid}
              onPress={() =>
                handleSave({
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
                  // La hora se conserva al EDITAR y se pone al crear: si al
                  // corregir un monto se cambiara, un movimiento de la manana
                  // pasaria a ser de la noche solo por haberlo tocado.
                  time: transaction?.time ?? horaDe(Date.now()),
                })
              }
              className={`flex-1 py-3.5 rounded-2xl items-center ${
                type === "expense" ? "bg-rose-500" : "bg-emerald-600"
              } ${!valid ? "opacity-40" : ""}`}
            >
              <Text className="font-bold text-white">{t("common.save")}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
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
          <View className="w-full bg-white dark:bg-slate-900 rounded-2xl p-2 border-[1.5px] border-slate-200 dark:border-slate-700">
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
    </View>
  );
}
