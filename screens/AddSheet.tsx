import { useEffect, useMemo, useRef, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { irUnaVez } from "@/utils/nav";
import { Image, Keyboard, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import Animated, {
  KeyboardState,
  useAnimatedKeyboard,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X, Check, ChevronDown, ChevronRight, Calendar, Star, Camera, ImageIcon, Repeat2, Pencil } from "lucide-react-native";
import CategoryAvatar from "@/components/CategoryAvatar";
import { catInfo, gastosDisponibles, ingresosDisponibles } from "@/constants/categories";
import { currencySymbolFor } from "@/constants/currencies";
import { COLOR_HEX_600 } from "@/constants/colors";
import { methodLabel, PAYMENT_METHODS } from "@/constants/i18n";
import { useAppData } from "@/contexts/AppDataContext";
import { defaultDateForMonth, isValidISODate, normalizeDateInput } from "@/utils/date";
import { parseAmountInput, sanitizeAmountInput } from "@/utils/amount";
import { nextId } from "@/utils/id";
import { horaDe } from "@/utils/format";
import { iconoDe, TODOS_LOS_GRUPOS } from "@/constants/iconos";
import { alternar, esFoto, getFavoritos } from "@/utils/iconosFavoritos";
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
  const { userCurrency, userCountry, t, categoriasPropias, categoriaRecienCreada, olvidarCategoriaRecienCreada, guardarFavoritos, showToast } =
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
  const [iconoConColores, setIconoConColores] = useState<string | null>(null);
  const [favoritos, setFavoritosLocales] = useState(() => getFavoritos());
  const [idsRapidos, setIdsRapidos] = useState<Record<"expense" | "income", string[]>>({
    expense: ["comida", "transporte", "compras"],
    income: ["salario", "freelance", "regalo"],
  });
  const lugarAReemplazar = useRef<number | null>(null);
  const [date, setDate] = useState(transaction?.date || defaultDateForMonth(currentMonth));
  const [method, setMethod] = useState(transaction?.method || "debit");
  const [description, setDescription] = useState(transaction?.description || "");
  const [notes, setNotes] = useState(transaction?.notes || "");
  const [showMethod, setShowMethod] = useState(false);
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

  // Las tres posiciones son estables: elegir un dibujo no debe hacer saltar
  // Comida al lugar de Transporte. Solo cambian cuando la persona usa ⇄ o
  // mantiene presionada expresamente una categoría.
  const categoriasRapidas = useMemo(() => {
    const elegidas = idsRapidos[type]
      .map((id) => cats.find((c) => c.id === id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));
    return [...elegidas, ...cats.filter((c) => !elegidas.some((e) => e.id === c.id))].slice(0, 3);
  }, [cats, idsRapidos, type]);

  function abrirCambioDeCategoria(indice: number) {
    lugarAReemplazar.current = indice;
    irUnaVez({ pathname: "/nueva-categoria", params: { tipo: type, actual: category } });
  }

  function abrirCambioDeNombre(categoryId: string) {
    lugarAReemplazar.current = null;
    irUnaVez({ pathname: "/nueva-categoria", params: { tipo: type, actual: categoryId, editar: "1" } });
  }

  function iconosRelacionados(categoryId: string): string[] {
    const info = catInfo(categoryId);
    const grupo = TODOS_LOS_GRUPOS.find((g) =>
      info.iconoNombre ? g.iconos.includes(info.iconoNombre) : false
    );
    return grupo?.iconos ?? TODOS_LOS_GRUPOS[TODOS_LOS_GRUPOS.length - 1].iconos;
  }

  function cambiarFavorito(id: string) {
    const siguientes = alternar(favoritos, id);
    setFavoritosLocales(siguientes);
    guardarFavoritos(siguientes);
  }

  function aplicarFoto(categoryId: string, asset: ImagePicker.ImagePickerAsset) {
    if (!asset.base64) return;
    setCategory(categoryId);
    setIcono(`data:${asset.mimeType ?? "image/jpeg"};base64,${asset.base64}`);
  }

  async function tomarFoto(categoryId: string) {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) {
      showToast(t("catCustom.cameraPermission"));
      return;
    }
    const resultado = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.7, base64: true });
    if (!resultado.canceled && resultado.assets[0]) aplicarFoto(categoryId, resultado.assets[0]);
  }

  async function elegirDeGaleria(categoryId: string) {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      showToast(t("settings.photoPermission"));
      return;
    }
    const resultado = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.7, base64: true });
    if (!resultado.canceled && resultado.assets[0]) aplicarFoto(categoryId, resultado.assets[0]);
  }

  const coloresRapidos = ["rose", "orange", "amber", "green", "emerald", "teal", "blue", "violet", "pink", "slate"];

  const metodosDisponibles = useMemo(
    () => PAYMENT_METHODS.filter((m) =>
      (m.id !== "plin" || userCountry === "PE")
      && (m.id !== "yape" || userCountry === "PE" || userCountry === "BO")
    ),
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
    if (lugarAReemplazar.current !== null) {
      const indice = lugarAReemplazar.current;
      setIdsRapidos((anteriores) => {
        const siguientes = [...anteriores[type]];
        siguientes[indice] = categoriaRecienCreada;
        return { ...anteriores, [type]: siguientes };
      });
      lugarAReemplazar.current = null;
    }
    setCategory(categoriaRecienCreada);
    // Al volver de "Ver todas", adopta también el dibujo de esa categoría.
    // El movimiento conserva así exactamente lo que la persona acaba de elegir.
    setIcono(catInfo(categoriaRecienCreada).iconoNombre);
    olvidarCategoriaRecienCreada();
  }, [categoriaRecienCreada, olvidarCategoriaRecienCreada, type]);

  useEffect(() => {
    if (!transaction) setCategory(type === "expense" ? "comida" : "salario");
    if (!transaction) setIcono(undefined);
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
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    exitAfterKeyboardHidden(() => onSave(t));
  }

  return (
    // Pantalla COMPLETA, no un panel flotante — cubre el dispositivo entero
    // sin importar el tipo de presentación con la que Expo Router la abra
    // (ver app/_layout.tsx). Esta View NUNCA cambia de tamaño ni de
    // posición por el teclado: es fija de principio a fin.
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
      <View className="flex-1 bg-white dark:bg-noche" style={{ paddingTop: insets.top }}>
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
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-noche-2 items-center justify-center"
          >
            <X size={16} color={colorScheme === "dark" ? "#94a3b8" : "#475569"} />
          </TouchableOpacity>
        </View>

        {!transaction && (
          <View className="px-5 mb-3">
            <View className="bg-slate-100 dark:bg-noche-2 rounded-xl p-1 flex-row">
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
            contentContainerClassName="gap-3 pb-5"
            keyboardShouldPersistTaps="handled"
          >
            <View>
              <Text className="text-xs font-semibold text-slate-600 dark:text-slate-200 mb-1.5">{t("addSheet.amount")}</Text>
              <View
                className="flex-row items-center bg-slate-50 dark:bg-noche-2 rounded-xl border-[1.5px] border-slate-200 dark:border-noche-borde px-4"
                style={{ height: 48 }}
              >
                <Text className="text-slate-500 dark:text-slate-300 font-bold mr-1">{currencySymbolFor(userCurrency)}</Text>
                <TextInput
                  disableFullscreenUI
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={(v) => setAmount(sanitizeAmountInput(v))}
                  placeholder="0.00"
                  placeholderTextColor="#94a3b8"
                  className="flex-1 text-base font-extrabold"
                  style={{ color: colorScheme === "dark" ? "#f1f5f9" : "#0f172a" }}
                />
              </View>
            </View>

            <View className="gap-2">
              <Text className="text-xs font-semibold text-slate-600 dark:text-slate-200">
                {t("addSheet.quickCategories")}
              </Text>
              {categoriasRapidas.map((cat, indice) => {
                const activa = cat.id === category;
                const IconoElegido = activa && icono && !esFoto(icono) ? iconoDe(icono) : null;
                return (
                  <View key={cat.id} className="gap-1.5">
                    <View className="flex-row items-center justify-between gap-2">
                    <TouchableOpacity
                      onPress={() => {
                        setCategory(cat.id);
                        setIcono(cat.iconoNombre);
                      }}
                      onLongPress={() => abrirCambioDeCategoria(indice)}
                      delayLongPress={450}
                      className={`flex-row items-center gap-1 rounded-full border px-2.5 py-1.5 shrink ${
                        activa
                          ? "bg-emerald-50 border-emerald-500 dark:bg-emerald-950"
                          : "bg-slate-50 border-slate-200 dark:bg-noche-2 dark:border-noche-borde"
                      }`}
                    >
                        {activa && esFoto(icono ?? "") ? (
                          <Image source={{ uri: icono }} className="w-5 h-5 rounded-full" />
                        ) : IconoElegido ? (
                          <IconoElegido size={15} color={COLOR_HEX_600[iconColor] ?? "#059669"} />
                        ) : (
                          <CategoryAvatar id={cat.id} size={15} />
                        )}
                      <Text
                        className={`text-xs font-bold ${activa ? "text-emerald-700 dark:text-emerald-300" : "text-slate-700 dark:text-slate-200"}`}
                      >
                        {t(cat.label)}
                      </Text>
                    </TouchableOpacity>
                    <View className="flex-row gap-1">
                      <TouchableOpacity accessibilityLabel={t("addSheet.changeQuickCategory")} onPress={() => abrirCambioDeCategoria(indice)} className="w-7 h-7 rounded-full items-center justify-center border border-slate-200 bg-slate-50 dark:bg-noche-2 dark:border-noche-borde">
                        <Repeat2 size={13} color="#64748b" />
                      </TouchableOpacity>
                      <TouchableOpacity accessibilityLabel={t("addSheet.renameCategory")} onPress={() => abrirCambioDeNombre(cat.id)} className="w-7 h-7 rounded-full items-center justify-center border border-slate-200 bg-slate-50 dark:bg-noche-2 dark:border-noche-borde">
                        <Pencil size={13} color="#64748b" />
                      </TouchableOpacity>
                      <TouchableOpacity accessibilityLabel={t("catCustom.takePhoto")} onPress={() => void tomarFoto(cat.id)} className="w-7 h-7 rounded-full items-center justify-center border border-slate-200 bg-slate-50 dark:bg-noche-2 dark:border-noche-borde">
                        <Camera size={15} color={colorScheme === "dark" ? "#cbd5e1" : "#475569"} />
                      </TouchableOpacity>
                      <TouchableOpacity accessibilityLabel={t("catCustom.pickImage")} onPress={() => void elegirDeGaleria(cat.id)} className="w-7 h-7 rounded-full items-center justify-center border border-slate-200 bg-slate-50 dark:bg-noche-2 dark:border-noche-borde">
                        <ImageIcon size={15} color={colorScheme === "dark" ? "#cbd5e1" : "#475569"} />
                      </TouchableOpacity>
                    </View>
                    </View>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 8, paddingRight: 16 }}
                    >
                      {iconosRelacionados(cat.id).map((id) => {
                        const Icono = iconoDe(id);
                        const marcado = activa && icono === id;
                        return (
                          <View key={id} className="w-11 h-11">
                          <TouchableOpacity
                            onPress={() => {
                              setCategory(cat.id);
                              if (activa && icono === id) {
                                setIcono(undefined);
                                setIconoConColores(null);
                              } else {
                                setIcono(id);
                                setIconColor(cat.color);
                                setIconoConColores(id);
                              }
                            }}
                            className={`w-10 h-10 mt-1 rounded-xl items-center justify-center border ${
                              marcado
                                ? "bg-emerald-50 border-emerald-500 dark:bg-emerald-950"
                                : "bg-slate-50 border-slate-200 dark:bg-noche-2 dark:border-noche-borde"
                            }`}
                          >
                            <Icono size={20} color={marcado ? "#059669" : colorScheme === "dark" ? "#cbd5e1" : "#475569"} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            accessibilityLabel={favoritos.includes(id) ? t("nuevaCat.favQuitado") : t("nuevaCat.favGuardado")}
                            onPress={() => cambiarFavorito(id)}
                            className="absolute right-0 top-0 w-5 h-5 rounded-full items-center justify-center bg-white dark:bg-noche-1 border border-amber-300"
                          >
                            <Star size={11} color="#f59e0b" fill={favoritos.includes(id) ? "#f59e0b" : "transparent"} />
                          </TouchableOpacity>
                          </View>
                        );
                      })}
                    </ScrollView>
                    {activa && iconoConColores === icono && !esFoto(icono ?? "") ? (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 9, paddingRight: 16 }}>
                        {coloresRapidos.map((color) => (
                          <TouchableOpacity
                            key={color}
                            accessibilityLabel={color}
                            onPress={() => setIconColor(color)}
                            className={`w-7 h-7 rounded-full items-center justify-center border-2 ${iconColor === color ? "border-slate-900 dark:border-white" : "border-transparent"}`}
                          >
                            <View className="w-5 h-5 rounded-full" style={{ backgroundColor: COLOR_HEX_600[color] }} />
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    ) : null}
                  </View>
                );
              })}

              <View className="flex-row items-center gap-2 pt-0.5">
                <View className="flex-1 min-w-0">
                  <View className="flex-row items-center gap-1 mb-1">
                    <Star size={14} color="#f59e0b" />
                    <Text className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      {t("nuevaCat.tabFavoritos")}
                    </Text>
                  </View>
                  {favoritos.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                      {favoritos.map((id) => {
                        const marcado = icono === id;
                        const Icono = esFoto(id) ? null : iconoDe(id);
                        return (
                          <TouchableOpacity
                            key={id}
                            onPress={() => setIcono(id)}
                            className={`w-9 h-9 rounded-xl items-center justify-center overflow-hidden border ${
                              marcado ? "border-amber-500 bg-amber-50" : "border-slate-200 bg-slate-50 dark:bg-noche-2 dark:border-noche-borde"
                            }`}
                          >
                            {esFoto(id) ? (
                              <Image source={{ uri: id }} className="w-full h-full" />
                            ) : Icono ? (
                              <Icono size={18} color={marcado ? "#d97706" : colorScheme === "dark" ? "#cbd5e1" : "#475569"} />
                            ) : null}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  ) : (
                    <Text className="text-[11px] text-slate-400">—</Text>
                  )}
                </View>
                <TouchableOpacity
                  onPress={() => {
                    lugarAReemplazar.current = null;
                    irUnaVez({
                      pathname: "/nueva-categoria",
                      params: { tipo: type, actual: category },
                    })
                  }}
                  className="flex-row items-center gap-1 rounded-full border border-slate-300 dark:border-noche-borde px-3 py-2"
                >
                  <Text className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    {t("addSheet.viewAllCategories")}
                  </Text>
                  <ChevronRight size={14} color="#94a3b8" />
                </TouchableOpacity>
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
                  className={`flex-row items-center gap-2 bg-slate-50 dark:bg-noche-2 rounded-xl border-[1.5px] px-3 ${
                    dateOk ? "border-slate-200 dark:border-noche-borde" : "border-rose-400"
                  }`}
                  style={{ height: FIELD_HEIGHT }}
                >
                  <Calendar size={16} color={dateOk ? "#94a3b8" : "#fb7185"} />
                  <TextInput
                    disableFullscreenUI
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
                {/* SE CIERRA EL TECLADO ANTES DE ABRIR LA LISTA (10/08/2026).
                    Con el teclado arriba —y suele estarlo, porque el monto se escribe justo
                    antes— la lista de métodos quedaba partida por la mitad: los últimos, Yape y
                    Plin, caían detrás de las teclas y no había forma de llegar a ellos.
                    Elegir el método no necesita teclado, así que se quita. */}
                <TouchableOpacity
                  onPress={() => {
                    Keyboard.dismiss();
                    setShowMethod(true);
                  }}
                  className="flex-row items-center justify-between gap-2 bg-slate-50 dark:bg-noche-2 rounded-xl border-[1.5px] border-slate-200 dark:border-noche-borde px-3"
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
                disableFullscreenUI
                value={description}
                onChangeText={setDescription}
                onFocus={focusDescription}
                placeholder={t("addSheet.descriptionPlaceholder")}
                placeholderTextColor="#94a3b8"
                className="w-full bg-slate-50 dark:bg-noche-2 rounded-xl border-[1.5px] border-slate-200 dark:border-noche-borde px-4 py-3.5 text-sm"
                style={{ color: colorScheme === "dark" ? "#f1f5f9" : "#0f172a" }}
              />
            </View>
            <View>
              <Text className="text-xs font-semibold text-slate-600 dark:text-slate-200 mb-1.5">{t("addSheet.notesOptional")}</Text>
              <TextInput
                disableFullscreenUI
                value={notes}
                onChangeText={setNotes}
                onFocus={focusNotes}
                placeholder={t("addSheet.notesPlaceholder")}
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={2}
                className="w-full bg-slate-50 dark:bg-noche-2 rounded-xl border-[1.5px] border-slate-200 dark:border-noche-borde px-4 py-3 text-sm"
                style={{ textAlignVertical: "top", color: colorScheme === "dark" ? "#f1f5f9" : "#0f172a" }}
              />
            </View>
          </ScrollView>

          {/* Botones: pegados al borde inferior de este contenedor animado.
              Cuando el teclado está abierto, insets.bottom (la barra de
              gestos del sistema) ya no hace falta —el teclado ocupa ese
              espacio— así que se omite para no dejar un hueco vacío de más. */}
          <View
            className="px-5 py-4 flex-row gap-3 border-t border-slate-200 dark:border-noche-borde bg-white dark:bg-noche-2"
            style={{ paddingBottom: keyboardVisible ? 16 : 16 + insets.bottom }}
          >
            <TouchableOpacity
              onPress={handleClose}
              className="flex-1 py-3.5 rounded-2xl bg-slate-100 dark:bg-noche-2 border-[1.5px] border-slate-300 dark:border-slate-500 items-center"
            >
              <Text className="font-bold text-slate-600 dark:text-slate-200">{t("common.cancel")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={!valid || submitting}
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
                  icono,
                  iconColor,
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
              } ${!valid || submitting ? "opacity-40" : ""}`}
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
