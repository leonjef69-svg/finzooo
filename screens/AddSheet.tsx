import { useEffect, useMemo, useRef, useState } from "react";
import { irUnaVez } from "@/utils/nav";
import { Keyboard, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import Animated, {
  KeyboardState,
  useAnimatedKeyboard,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, ChevronDown, Calendar, Clock } from "lucide-react-native";
import CategoryAvatar from "@/components/CategoryAvatar";
import TransactionCategorySheet from "@/components/TransactionCategorySheet";
import { catInfo, gastosDisponibles, ingresosDisponibles } from "@/constants/categories";
import { COUNTRIES } from "@/constants/countries";
import { currencySymbolFor } from "@/constants/currencies";
import { methodLabel } from "@/constants/i18n";
import { useAppData } from "@/contexts/AppDataContext";
import { defaultDateForMonth, isValidISODate, normalizeDateInput } from "@/utils/date";
import { amountInputError, parseAmountInput, sanitizeSafeAmountInput } from "@/utils/amount";
import { nextId } from "@/utils/id";
import { horaDe } from "@/utils/format";
import { availablePaymentMethods, initialPaymentMethod } from "@/utils/paymentMethods";
import type { Month, Transaction } from "@/types";
import { useColorScheme } from "nativewind";

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
  const { userCurrency, userCountry, t, categoriasPropias, categoriaRecienCreada, olvidarCategoriaRecienCreada } =
    useAppData();
  const [type, setType] = useState<"expense" | "income">(
    initialType || transaction?.type || "expense"
  );
  const [amount, setAmount] = useState(transaction ? String(transaction.amount) : "");
  const [category, setCategory] = useState(
    transaction?.category || (type === "expense" ? "comida" : "salario")
  );
  const [icono, setIcono] = useState<string | undefined>(transaction?.icono);
  const [iconColor, setIconColor] = useState(
    transaction?.iconColor ?? catInfo(transaction?.category ?? (initialType === "income" ? "salario" : "comida")).color
  );
  const [date, setDate] = useState(transaction?.date || defaultDateForMonth(currentMonth));
  const [time] = useState(transaction?.time || horaDe(Date.now()));
  const [method, setMethod] = useState(initialPaymentMethod(transaction));
  const [description, setDescription] = useState(transaction?.description || "");
  const [notes, setNotes] = useState(transaction?.notes || "");
  const [showMethod, setShowMethod] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
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
  const selectedCategory = catInfo(category);
  const countryFlag = COUNTRIES.find((country) => country.id === userCountry)?.flag ?? "🌐";

  function seleccionarCategoria(id: string) {
    const info = catInfo(id);
    setCategory(id);
    setIcono(info.iconoNombre);
    setIconColor(info.color);
    setShowCategories(false);
  }

  function cambiarTipo(nextType: "expense" | "income") {
    setType(nextType);
    const categories = nextType === "expense" ? gastosDisponibles() : ingresosDisponibles();
    if (categories.some((item) => item.id === category)) return;

    // No conservar una categoría de gasto en un ingreso (ni al revés).
    // Si la actual no pertenece al tipo nuevo, partir de su categoría habitual.
    const fallback = nextType === "expense" ? "comida" : "salario";
    const info = catInfo(fallback);
    setCategory(fallback);
    setIcono(info.iconoNombre);
    setIconColor(info.color);
  }

  const metodosDisponibles = useMemo(
    () => availablePaymentMethods(userCountry),
    [userCountry]
  );

  // La categoría que llega de la otra pantalla: la que se acaba de elegir en
  // "Elegir categoría", o la que se acaba de crear. Es el mismo canal para las
  // dos porque significan lo mismo: "adopta esta".
  //
  // Ya no hace falta abrir nada más al recibirla: antes había que encender el
  // "Ver más" porque las propias vivían escondidas detrás de ese botón, y sin
  // eso se elegía una que no se veía. Aquí ahora solo hay un botón, y el botón
  // enseña la que esté puesta, sea de fábrica o propia.
  useEffect(() => {
    if (!categoriaRecienCreada) return;
    setCategory(categoriaRecienCreada);
    // Una categoría creada desde el selector queda elegida de inmediato.
    setIcono(catInfo(categoriaRecienCreada).iconoNombre);
    olvidarCategoriaRecienCreada();
  }, [categoriaRecienCreada, olvidarCategoriaRecienCreada]);

  useEffect(() => {
    if (!transaction) setCategory(type === "expense" ? "comida" : "salario");
    if (!transaction) setIcono(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  // Guardar exige monto positivo Y fecha real. Antes solo se miraba el
  // monto, así que una fecha escrita a mano de cualquier forma se guardaba
  // igual y rompía la app al mostrarla.
  const dateOk = isValidISODate(date);
  const valid = parseAmountInput(amount, userCurrency) > 0 && dateOk;
  const amountError = amountInputError(amount, userCurrency);

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
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    exitAfterKeyboardHidden(() => onSave(t));
  }

  function createMovement(): Transaction {
    return {
      // Mantiene los campos que este formulario no modifica, como el origen,
      // la cuenta y los datos usados para detectar movimientos duplicados.
      ...transaction,
      id: transaction?.id || nextId(),
      type,
      amount: parseAmountInput(amount, userCurrency),
      category,
      icono,
      iconColor,
      date,
      method,
      description,
      notes,
      // Al editar se conserva la hora original; solo se genera al crear.
      time,
    };
  }

  return (
    // El alta nueva es un panel inferior superpuesto a Inicio. La edición de
    // un movimiento conserva su pantalla completa de siempre.
    <View className={transaction ? "flex-1" : "absolute inset-0 justify-end"}>
      {!transaction ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t("common.cancel")}
          activeOpacity={1}
          onPress={handleClose}
          className="absolute inset-0 bg-slate-900/45"
        />
      ) : null}
      <View
        className={transaction
          ? "flex-1 bg-white dark:bg-noche"
          : "w-full overflow-hidden rounded-t-[28px] border-t border-slate-200 bg-white dark:border-noche-borde dark:bg-noche"}
        style={transaction
          ? { paddingTop: insets.top }
          : { maxHeight: keyboardVisible ? "90%" : "64%", paddingTop: 4 }}
      >
        {!transaction ? <View className="mb-1 mt-2 h-1 w-10 self-center rounded-full bg-slate-300 dark:bg-noche-3" /> : null}
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
            accessibilityRole="button"
            accessibilityLabel={t("common.save")}
            disabled={!valid || submitting}
            onPress={() => handleSave(createMovement())}
            className={`w-10 h-10 rounded-full items-center justify-center ${
              type === "expense" ? "bg-rose-500" : "bg-emerald-600"
            } ${!valid || submitting ? "opacity-40" : ""}`}
          >
            <Check size={19} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {!transaction && (
          <View className="px-5 mb-3">
            <View className="bg-slate-100 dark:bg-noche-2 rounded-xl p-1 flex-row">
              {(["expense", "income"] as const).map((opt) => (
                <TouchableOpacity
                  key={opt}
                  onPress={() => cambiarTipo(opt)}
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

        {/* Único bloque que reacciona al teclado: campos con scroll dentro
            de un contenedor animado cuyo
            "paddingBottom" sigue la altura real del teclado (ver
            animatedPaddingStyle arriba). Cuando el teclado aparece, este
            bloque (no la pantalla completa) se achica desde abajo — el
            ScrollView dentro se ajusta solo por ser flex:1. Guardar queda en
            la cabecera fija, siempre visible aunque aparezca el teclado. */}
        <Animated.View
          style={[
            transaction ? { flex: 1, minHeight: 0 } : { flexShrink: 1, minHeight: 0 },
            animatedPaddingStyle,
          ]}
        >
          <ScrollView
            ref={scrollRef}
            className={transaction ? "flex-1 px-5" : "px-5"}
            style={transaction ? { minHeight: 0 } : { flexGrow: 0, flexShrink: 1 }}
            contentContainerClassName="gap-3"
            contentContainerStyle={{ paddingBottom: keyboardVisible ? 16 : 16 + insets.bottom }}
            keyboardShouldPersistTaps="handled"
          >
            <View>
              <Text className="text-xs font-semibold text-slate-600 dark:text-slate-200 mb-1.5">{t("addSheet.amount")}</Text>
              <View
                className="bg-slate-50 dark:bg-noche-2 rounded-2xl border-[1.5px] border-slate-200 dark:border-noche-borde px-4 py-2"
                style={{ minHeight: 76 }}
              >
                <View className="flex-row items-center gap-1.5">
                  <Text className="text-sm">{countryFlag}</Text>
                  <Text className="text-[10px] font-extrabold text-slate-500 dark:text-slate-300">
                    {currencySymbolFor(userCurrency)} · {userCurrency}
                  </Text>
                </View>
                <TextInput
                  disableFullscreenUI
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={(v) => setAmount(sanitizeSafeAmountInput(v, userCurrency))}
                  placeholder="0"
                  placeholderTextColor="#94a3b8"
                  className="h-9 py-0 text-2xl font-extrabold"
                  style={{ padding: 0, color: colorScheme === "dark" ? "#f1f5f9" : "#0f172a" }}
                />
              </View>
              {amountError ? <Text className="mt-1 text-xs text-red-600 dark:text-red-400">{t(amountError === "tooLarge" ? "toast.amountTooLarge" : "toast.amountDecimals")}</Text> : null}
            </View>

            <View className="flex-row items-start gap-2.5">
              <View onLayout={(e) => setDescriptionY(e.nativeEvent.layout.y)} className="min-w-0 flex-1">
                <Text className="mb-1.5 text-xs font-semibold text-slate-600 dark:text-slate-200">{t("addSheet.description")}</Text>
                <TextInput
                  disableFullscreenUI
                  value={description}
                  onChangeText={setDescription}
                  onFocus={focusDescription}
                  placeholder={t("addSheet.descriptionPlaceholder")}
                  placeholderTextColor="#94a3b8"
                  className="h-12 w-full rounded-xl border-[1.5px] border-slate-200 bg-slate-50 px-3 text-sm dark:border-noche-borde dark:bg-noche-2"
                  style={{ color: colorScheme === "dark" ? "#f1f5f9" : "#0f172a" }}
                />
              </View>

              <View className="min-w-0 flex-1">
                <Text className="mb-1.5 text-xs font-semibold text-slate-600 dark:text-slate-200">{t("detail.method")}</Text>
                <TouchableOpacity
                  onPress={() => { Keyboard.dismiss(); setShowMethod(true); }}
                  accessibilityRole="button"
                  className="h-12 flex-row items-center justify-between rounded-xl border-[1.5px] border-slate-200 bg-slate-50 px-2.5 dark:border-noche-borde dark:bg-noche-2"
                >
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78} className="min-w-0 flex-1 text-xs font-semibold text-slate-800 dark:text-slate-100">
                    {methodLabel(method, t)}
                  </Text>
                  <ChevronDown size={15} color="#64748b" />
                </TouchableOpacity>
              </View>
            </View>

            <View className="flex-row items-start gap-2.5">
              <View className="min-w-0 flex-1">
                <Text className="mb-1.5 text-xs font-semibold text-slate-600 dark:text-slate-200">{t("detail.category")}</Text>
                <TouchableOpacity
                  onPress={() => { Keyboard.dismiss(); setShowCategories(true); }}
                  accessibilityRole="button"
                  accessibilityLabel={`${t("detail.category")}: ${t(selectedCategory.label)}`}
                  className="h-12 flex-row items-center justify-between rounded-xl border-[1.5px] border-slate-200 bg-slate-50 px-3 dark:border-noche-borde dark:bg-noche-2"
                >
                  <View className="min-w-0 flex-1 flex-row items-center gap-2">
                    <CategoryAvatar id={category} size={20} />
                    <Text numberOfLines={1} className="min-w-0 flex-1 text-xs font-semibold text-slate-800 dark:text-slate-100">
                      {t(selectedCategory.label)}
                    </Text>
                  </View>
                  <ChevronDown size={15} color="#64748b" />
                </TouchableOpacity>
              </View>

              <View className="min-w-0 flex-1">
                <Text className="mb-1.5 text-xs font-semibold text-slate-600 dark:text-slate-200">{t("detail.date")}</Text>
                <View
                  className={`h-12 flex-row items-center gap-2 rounded-xl border-[1.5px] bg-slate-50 px-3 dark:bg-noche-2 ${
                    dateOk ? "border-slate-200 dark:border-noche-borde" : "border-rose-400"
                  }`}
                >
                  <Calendar size={15} color={dateOk ? "#94a3b8" : "#fb7185"} />
                  <TextInput
                    disableFullscreenUI
                    value={date}
                    onChangeText={setDate}
                    onBlur={() => setDate((d) => normalizeDateInput(d))}
                    placeholder="AAAA-MM-DD"
                    placeholderTextColor="#94a3b8"
                    className="min-w-0 flex-1 text-xs font-semibold"
                    style={{ padding: 0, color: colorScheme === "dark" ? "#f1f5f9" : "#0f172a" }}
                  />
                </View>
                {!dateOk ? <Text className="mt-1 text-[11px] font-semibold text-rose-500">{t("addSheet.dateError")}</Text> : null}
                <View className="mt-1.5 flex-row items-center gap-1.5 pl-1">
                  <Clock size={13} color="#94a3b8" />
                  <Text className="text-xs font-medium text-slate-500 dark:text-slate-300">{time}</Text>
                </View>
              </View>
            </View>

            <View>
              <Text className="mb-1.5 text-xs font-semibold text-slate-600 dark:text-slate-200">{t("addSheet.notesOptional")}</Text>
              <TextInput
                disableFullscreenUI
                value={notes}
                onChangeText={setNotes}
                onFocus={focusNotes}
                placeholder={t("addSheet.notesPlaceholder")}
                placeholderTextColor="#94a3b8"
                className="h-12 w-full rounded-xl border-[1.5px] border-slate-200 bg-slate-50 px-3 text-sm dark:border-noche-borde dark:bg-noche-2"
                style={{ color: colorScheme === "dark" ? "#f1f5f9" : "#0f172a" }}
              />
            </View>
          </ScrollView>

        </Animated.View>
      </View>

      {showCategories ? (
        <TransactionCategorySheet
          type={type}
          categories={cats}
          selectedId={category}
          onClose={() => setShowCategories(false)}
          onSelect={seleccionarCategoria}
          onManage={() => {
            setShowCategories(false);
            irUnaVez({ pathname: "/nueva-categoria", params: { tipo: type, actual: category } });
          }}
        />
      ) : null}

      {/* Selector de método de pago.
          Va aquí fuera, encima de todo, y NO dentro de la lista con scroll.
          Cuando estaba dentro, Android recortaba lo que sobresalía de esa
          zona: solo se veían 4 de los 6 métodos y era imposible llegar a
          Yape y Plin por mucho que se arrastrara. */}
      {showMethod && (
        <View className="absolute inset-0 z-50 items-center justify-center px-8">
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("common.close")}
            className="absolute inset-0 bg-slate-900/60"
            activeOpacity={1}
            onPress={() => setShowMethod(false)}
          />
          <View className="w-full bg-white dark:bg-noche-2 rounded-2xl p-2 border-[1.5px] border-slate-200 dark:border-noche-borde">
            <Text className="text-xs font-bold text-slate-500 dark:text-slate-300 px-3 pt-2 pb-1">
              {t("detail.method")}
            </Text>
            {metodosDisponibles.map((m) => {
              const active = m.id === method;
              return (
                <TouchableOpacity
                  key={m.id}
                  onPress={() => {
                    setMethod(m.id);
                    setShowMethod(false);
                  }}
                  className={`w-full px-3 py-3.5 rounded-xl flex-row items-center justify-between ${
                    active ? "bg-slate-100 dark:bg-noche-2" : ""
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
