import { useEffect, useState } from "react";
import { ActivityIndicator, Image, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import {
  CalendarClock,
  Camera,
  Check,
  ChevronRight,
  Cloud,
  Crown,
  FileDown,
  FileUp,
  Lock,
  PiggyBank,
  PieChart,
  Coins,
  MapPin,
  Bell,
  KeyRound,
  Pencil,
  UserX,
  LogOut,
  Info,
  Shield,
  Store,
  Zap,
  Mic,
  MessageSquare,
  X,
} from "lucide-react-native";
import * as voiceWidget from "@/modules/voice-widget";
import { useColorScheme } from "nativewind";
import { router } from "expo-router";
import Row from "@/components/Row";
import ThemeToggleButton from "@/components/ThemeToggleButton";
import Toggle from "@/components/Toggle";
import { currencyLabelFor } from "@/constants/currencies";
import { countryFor } from "@/constants/countries";
import { hayRegistroAutomatico } from "@/utils/dondeHayYape";
import { avisosEncendidos, guardarAvisosEncendidos } from "@/utils/avisosDePagos";
import { useAppData } from "@/contexts/AppDataContext";

// Achica y comprime la foto antes de guardarla, para que no pese mucho
// (así se guarda rápido y no ocupa espacio de más en la nube).
async function compressPhoto(uri: string): Promise<string> {
  const context = ImageManipulator.manipulate(uri).resize({ width: 240 });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ base64: true, compress: 0.5, format: SaveFormat.JPEG });
  return `data:image/jpeg;base64,${saved.base64}`;
}

export default function Settings({
  userName,
  userEmail,
  userPhoto,
  onSaveProfile,
  userCurrency,
  onCurrency,
  userLanguage,
  onLanguage,
  onCountry,
  isPremium,
  onCategoryBudgets,
  onCategoryStyle,
  onExportPdf,
  onScheduledExport,
  onImport,
  onAutoCapture,
  onLogout,
  onPremium,
  onSavings,
  onAppLock,
  onChangePassword,
  onDeleteAccount,
  onAbout,
  onLegal,
  onVoiceHelp,
}: {
  userName: string;
  userEmail: string;
  userPhoto: string | null;
  onSaveProfile: (name: string, photo: string | null) => void;
  userCurrency: string;
  onCurrency: () => void;
  userLanguage: string;
  onLanguage: () => void;
  onCountry: () => void;
  isPremium: boolean;
  onCategoryBudgets: () => void;
  onCategoryStyle: () => void;
  onExportPdf: () => void;
  onScheduledExport: () => void;
  onImport: () => void;
  onAutoCapture: () => void;
  onLogout: () => void;
  onPremium: () => void;
  onSavings: () => void;
  onAppLock: () => void;
  onChangePassword: () => void;
  onDeleteAccount: () => void;
  onAbout: () => void;
  onLegal: () => void;
  onVoiceHelp: () => void;
}) {
  const { t, isCloudSynced, respaldoAlDia, respaldoFallo, autoCaptureOn, showToast, negocios, reprogramarAvisos } =
    useAppData();
  /** El negocio que se está quedando con los yapeos, si hay alguno. Ver la fila de abajo. */
  const negocioQueRecibe = negocios.find((n) => n.activo && n.destinoYapes === "negocio");

  // Le pide a Android que coloque el widget del micrófono. Si el lanzador
  // del celular no lo permite (algunos que se instalan aparte no lo
  // implementan), se explica el camino a mano en vez de dejar la sensación
  // de que el botón no hizo nada.
  function addWidgetToHomeScreen(variant: voiceWidget.WidgetVariant) {
    const placed = voiceWidget.requestPin(variant);
    if (!placed) showToast(t("widget.manualHint"));
  }
  const { colorScheme } = useColorScheme();
  const primaryTextColor = colorScheme === "dark" ? "#f1f5f9" : "#0f172a";
  /**
   * EL INTERRUPTOR DE AVISOS, QUE HASTA HOY NO HACÍA NADA (19/08/2026).
   *
   * Era un `useState` suelto: se movía y se quedaba ahí. Lo preguntó él —*"tenemos en
   * ajustes una opción de notificación, eso sirve, está de adorno, hace algo?"*— y la
   * respuesta era que no. Es justo lo que este proyecto lleva meses quitando: un botón que
   * promete y no cumple.
   *
   * Ahora manda de verdad sobre los avisos del calendario: apagarlo retira los que estén
   * puestos, encenderlo los vuelve a programar solos. No borra ningún pago.
   */
  const [notif, setNotif] = useState(true);
  useEffect(() => {
    avisosEncendidos().then(setNotif);
  }, []);
  // Qué país corresponde al idioma y la moneda puestos. Puede no haber
  // ninguno si alguien los ajustó por separado a una combinación que no es
  // de ningún país; ahí la fila sale sin nombre en vez de mentir.
  const paisActual = countryFor(userLanguage, userCurrency);
  const insets = useSafeAreaInsets();

  const [pickingPhoto, setPickingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(userName);
  const [nameError, setNameError] = useState("");

  async function pickPhoto() {
    setPhotoError("");
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setPhotoError(t("settings.photoPermission"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;

    setPickingPhoto(true);
    try {
      const compressed = await compressPhoto(result.assets[0].uri);
      onSaveProfile(userName, compressed);
    } catch {
      setPhotoError(t("settings.photoError"));
    } finally {
      setPickingPhoto(false);
    }
  }

  function startEditName() {
    setNameInput(userName);
    setNameError("");
    setEditingName(true);
  }

  function saveName() {
    if (nameInput.trim().length < 2) {
      setNameError(t("settings.nameError"));
      return;
    }
    onSaveProfile(nameInput.trim(), userPhoto);
    setEditingName(false);
  }

  return (
    <ScrollView
      className="flex-1 bg-white dark:bg-noche"
      contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 112 }}
    >
      <View className="px-5 pt-3 pb-1 flex-row items-center justify-between">
        <Text className="text-xl font-extrabold" style={{ color: primaryTextColor }}>{t("settings.title")}</Text>
        <ThemeToggleButton />
      </View>

      {/* LA TARJETA DEL PERFIL, EN HORIZONTAL (12/08/2026).

          Reportado con la captura: *"muy grande ese recuadro con la foto pequeña, se ve raro"*.
          Y era exactamente eso: la foto, el nombre y el correo iban centrados uno debajo de
          otro, así que la tarjeta medía casi lo mismo que las cinco filas de Ajustes juntas y
          la mayor parte era aire alrededor de una foto de 80 px.

          Puestos en fila —foto a la izquierda, nombre y correo al lado— la tarjeta baja a la
          mitad de alto y la foto deja de verse perdida. No se quita nada: siguen estando la
          cámara para cambiarla, el lápiz para el nombre y los dos avisos de error. */}
      <View className="mx-5 mt-3 bg-white dark:bg-noche-2 rounded-2xl p-3.5 border-[1.5px] border-slate-200 dark:border-noche-borde">
        <View className="flex-row items-center gap-3.5">
          <TouchableOpacity onPress={pickPhoto} disabled={pickingPhoto} activeOpacity={0.8}>
            <View className="w-[76px] h-[76px] rounded-full bg-emerald-600 items-center justify-center overflow-hidden">
              {userPhoto ? (
                <Image source={{ uri: userPhoto }} style={{ width: 76, height: 76 }} />
              ) : (
                <Text className="text-white text-2xl font-extrabold">{userName[0]}</Text>
              )}
            </View>
            <View className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-slate-900 items-center justify-center border-2 border-white">
              {pickingPhoto ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Camera size={13} color="#ffffff" />
              )}
            </View>
          </TouchableOpacity>

          {/* EL NOMBRE CENTRADO Y EL LÁPIZ A UN LADO (12/08/2026).

              Pedido suyo. Antes el lápiz iba pegado al nombre, dentro de la misma fila, así que
              el nombre no podía centrarse: quedaba corrido hacia la izquierda por el ancho del
              botón. Sacando el lápiz al borde de la tarjeta, el centro es el centro de verdad y
              el botón sigue a la vista sin meterse en medio.

              min-w-0 NO ES ADORNO: sin él, un nombre o un correo largo empujan la tarjeta fuera
              de la pantalla en vez de recortarse con puntos suspensivos. */}
          <View className="flex-1 min-w-0">
            {editingName ? (
              /* AL EDITAR, TODO DEL MISMO TAMAÑO QUE AL MIRAR. El nombre pasaba de 18 a 14 y los
                 botones de 32 a 28, así que la tarjeta se encogía justo al entrar a escribir. */
              <View className="flex-row items-center gap-2">
                <TextInput
                  value={nameInput}
                  onChangeText={setNameInput}
                  placeholder={t("settings.namePlaceholder")}
                  autoFocus
                  className="flex-1 text-lg font-bold border-b border-emerald-400 py-1"
                  style={{ color: primaryTextColor }}
                />
                <TouchableOpacity
                  onPress={saveName}
                  hitSlop={6}
                  className="w-9 h-9 rounded-full bg-emerald-600 items-center justify-center"
                >
                  <Check size={17} color="#ffffff" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setEditingName(false)}
                  hitSlop={6}
                  className="w-9 h-9 rounded-full bg-slate-100 dark:bg-noche-2 items-center justify-center"
                >
                  <X size={17} color="#64748b" />
                </TouchableOpacity>
              </View>
            ) : (
              <View className="items-center">
                <Text
                  className="font-bold text-lg text-center"
                  numberOfLines={1}
                  style={{ color: primaryTextColor }}
                >
                  {userName}
                </Text>
                {userEmail ? (
                  <Text
                    className="text-xs text-slate-500 dark:text-slate-300 mt-0.5 text-center"
                    numberOfLines={1}
                  >
                    {userEmail}
                  </Text>
                ) : null}
              </View>
            )}
            {nameError ? (
              <Text className="text-rose-500 text-xs font-medium mt-1 text-center">{nameError}</Text>
            ) : null}
          </View>

          {/* EL LÁPIZ, EN EL BORDE. Fuera de la fila del nombre para que el centrado sea real.
              Al editar desaparece: sus botones —aceptar y cancelar— ya están dentro. */}
          {!editingName && (
            <TouchableOpacity
              onPress={startEditName}
              hitSlop={10}
              className="w-8 h-8 rounded-full bg-slate-100 dark:bg-noche-2 items-center justify-center"
            >
              <Pencil size={15} color="#64748b" />
            </TouchableOpacity>
          )}
        </View>

        {photoError ? (
          <Text className="text-rose-500 text-xs font-medium mt-2">{photoError}</Text>
        ) : null}
      </View>

      <TouchableOpacity onPress={onPremium} className="mx-5 mt-3 rounded-2xl overflow-hidden">
        <LinearGradient
          colors={["#fbbf24", "#f59e0b"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          className="flex-row items-center gap-3 p-4"
        >
          <Crown size={20} color="#ffffff" />
          <View className="flex-1">
            <Text className="font-extrabold text-white text-sm">
              {isPremium ? t("settings.premiumActive") : t("settings.becomePremium")}
            </Text>
            <Text className="text-[11px] text-amber-50">
              {isPremium ? t("settings.premiumThanks") : t("settings.premiumUnlock")}
            </Text>
          </View>
          <ChevronRight size={16} color="#ffffff" />
        </LinearGradient>
      </TouchableOpacity>

      {/* EL CARTEL DICE LO QUE DE VERDAD PASO CON LA ULTIMA SUBIDA.
          Hasta el 20/08/2026 solo miraba `isCloudSynced`, que es "hay sesion iniciada" — asi
          que decia "Tus datos estan respaldados" aunque la subida llevara semanas fallando.
          Un respaldo que miente es peor que no tener respaldo: con el segundo, uno guarda una
          copia por su cuenta. */}
      {isCloudSynced && (
        <View
          className={`mx-5 mt-3 flex-row items-center gap-3 rounded-2xl p-3.5 border-[1.5px] ${
            respaldoAlDia
              ? "bg-emerald-50 dark:bg-noche-2 border-emerald-100 dark:border-noche-borde"
              : "bg-amber-50 dark:bg-noche-2 border-amber-200 dark:border-noche-borde"
          }`}
        >
          <View
            className={`w-9 h-9 rounded-xl items-center justify-center ${
              respaldoAlDia ? "bg-emerald-100 dark:bg-noche-3" : "bg-amber-100 dark:bg-noche-3"
            }`}
          >
            <Cloud size={16} color={respaldoAlDia ? "#059669" : "#d97706"} />
          </View>
          <View className="flex-1">
            <Text
              className={`text-sm font-bold ${
                respaldoAlDia ? "text-emerald-700 dark:text-slate-100" : "text-amber-700 dark:text-slate-100"
              }`}
            >
              {t(respaldoAlDia ? "settings.backupActive" : "settings.backupFailed")}
            </Text>
            <Text
              className={`text-[11px] ${
                respaldoAlDia ? "text-emerald-600 dark:text-slate-300" : "text-amber-700 dark:text-slate-300"
              }`}
            >
              {respaldoAlDia
                ? t("settings.backupDescription")
                : /* EL MOTIVO, ESCRITO TAL CUAL. Sin el, "no se pudo guardar" no da para
                     hacer nada: no distingue entre falta de internet, permisos o que no
                     quepa. Con el, la propia pantalla dice que pasa. */
                  t(
                    respaldoFallo === "permisos"
                      ? "settings.backupNoPermission"
                      : respaldoFallo === "sin-internet"
                        ? "settings.backupNoInternet"
                        : "settings.backupFailedHint"
                  )}
            </Text>
          </View>
        </View>
      )}

      <View className="px-5 mt-5 gap-2.5">
        <Text className="text-xs font-bold text-slate-500 dark:text-slate-300 px-1">{t("settings.sectionSettings")}</Text>
        <Row
          Icon={PieChart}
          label={t("categoryBudgets.rowLabel")}
          onPress={onCategoryBudgets}
          right={
            <View className="bg-amber-50 px-2 py-1 rounded-full">
              <Text className="text-[10px] font-extrabold text-amber-500">PRO</Text>
            </View>
          }
        />
        <Row
          Icon={FileDown}
          label={t("exportPdf.exportDataTitle")}
          onPress={onExportPdf}
          right={
            <View className="bg-amber-50 px-2 py-1 rounded-full">
              <Text className="text-[10px] font-extrabold text-amber-500">PRO</Text>
            </View>
          }
        />
        {/* AQUÍ ESTABA "PERSONALIZAR CATEGORÍAS".
            Quitada a petición del usuario el 03/08/2026: no le servía y
            ocupaba sitio en un menú ya largo.

            La pantalla NO se borró: sigue en screens/CategoryCustomize y en
            la ruta /category-style, y lo que cada quien tuviera
            personalizado se sigue aplicando. Solo se quitó la puerta de
            entrada, que es lo reversible. */}
        <Row
          Icon={CalendarClock}
          label={t("schedExport.settingsRow")}
          onPress={onScheduledExport}
          right={
            <View className="bg-amber-50 px-2 py-1 rounded-full">
              <Text className="text-[10px] font-extrabold text-amber-500">PRO</Text>
            </View>
          }
        />
        <Row
          Icon={FileUp}
          label={t("importSheet.rowLabel")}
          onPress={onImport}
          right={
            <View className="bg-amber-50 px-2 py-1 rounded-full">
              <Text className="text-[10px] font-extrabold text-amber-500">PRO</Text>
            </View>
          }
        />
        {/* CALENDARIO DE PAGOS. Va antes del Modo Negocio y de la captura porque es de la
            misma familia —cosas que cambian CÓMO entra y sale el dinero— y porque es la
            única de las tres que sirve a cualquiera, tenga negocio o no.
            Sin candado PRO: decisión del 18/08/2026. Es la clase de función que hace volver
            a abrir la app cada semana, y eso es justo lo que hace falta con la app recién
            publicada y sin usuarios. */}
        <Row
          Icon={CalendarClock}
          label={t("calendario.titulo")}
          onPress={() => router.push("/calendario")}
        />
        {/* MODO NEGOCIO. Va aquí, entre importar y la captura automática, porque es de la
            misma familia: cosas que cambian CÓMO entra el dinero, no ajustes de la cuenta.
            Con la etiqueta PRO igual que las otras Premium: quien la ve sabe antes de tocar
            que va a encontrar un candado. */}
        <Row
          Icon={Store}
          label={t("negocios.rowLabel")}
          // QUÉ ESTÁ PASANDO, SIN TENER QUE ENTRAR. Si un negocio se está quedando con los
          // yapeos, eso cambia dónde cae la plata todos los días: no puede estar solo a tres
          // pantallas de distancia. Y si se apagara sin querer, aquí se nota.
          hint={negocioQueRecibe ? t("negocios.rowYapes", { nombre: negocioQueRecibe.nombre }) : undefined}
          // CON UN SOLO NEGOCIO SE ENTRA DIRECTO A SU PANEL. La lista de negocios con un solo
          // negocio es una pantalla que solo sirve para tocar la única fila que tiene. Con dos
          // o más sí hace falta elegir.
          onPress={() =>
            router.push(negocios.length === 1 ? `/negocio/${negocios[0].id}` : "/negocio")
          }
          right={
            <View className="bg-amber-50 px-2 py-1 rounded-full">
              <Text className="text-[10px] font-extrabold text-amber-500">PRO</Text>
            </View>
          }
        />
        {/* SOLO DONDE HAY YAPE. Ver utils/dondeHayYape: en Colombia o Argentina esta función no
            falla, es que no tiene nada que leer, y enseñarla haría que alguien diera el permiso
            de leer TODAS sus notificaciones para esperar movimientos que no van a llegar.
            ESTA SÍ SE ESCONDE, y no se toca al devolver las demás: es lo único que de verdad
            no existe fuera de Perú y Bolivia. Las Premium se ven en todas partes porque se
            pueden comprar en todas partes. */}
        {hayRegistroAutomatico(userCurrency) && (
          <Row
            Icon={Zap}
            label={t("autoCapture.rowLabel")}
            onPress={onAutoCapture}
            right={
              autoCaptureOn ? (
                <View className="bg-violet-50 px-2 py-1 rounded-full">
                  <Text className="text-[10px] font-extrabold text-violet-500">{t("autoCapture.rowOn")}</Text>
                </View>
              ) : (
                <ChevronRight size={16} color="#cbd5e1" />
              )
            }
          />
        )}
        {/* Una sola fila, no dos. Antes había una por cada tamaño de
            widget (el círculo y el ancho con texto), y con el mismo icono
            y textos casi iguales se leían como una opción repetida. Esta
            coloca el círculo, que es el que ocupa lo mismo que un ícono
            normal; el ancho sigue existiendo en la lista de widgets de
            Android para quien lo prefiera. */}
        {/* EL MICRÓFONO ES PREMIUM (11/08/2026), dicho por él. Se VE —con su etiqueta, como las
            demás— y el candado aparece al tocar: es la forma que eligió para todas las de pago.
            Sin Premium lleva a la pantalla de venta en vez de colocar el widget: poner en el
            escritorio un botón que luego no deja pasar es peor que no ponerlo. */}
        {voiceWidget.isSupported && (
          <Row
            Icon={Mic}
            label={t("widget.rowLabel")}
            onPress={() => (isPremium ? addWidgetToHomeScreen("round") : onPremium())}
            right={
              <View className="bg-amber-50 px-2 py-1 rounded-full">
                <Text className="text-[10px] font-extrabold text-amber-500">PRO</Text>
              </View>
            }
          />
        )}
        {/* QUE SE LE PUEDE DECIR AL MICROFONO.
            Va pegada a la del widget porque las dos hablan de lo mismo. El
            microfono entiende anotar, preguntar, comparar y exportar, y nada
            de eso se ve en ninguna parte: sin esta pantalla se usa solo para
            lo primero, que es lo unico que se adivina al tocarlo. */}
        <Row
          Icon={MessageSquare}
          label={t("voiceHelp.rowLabel")}
          // ESTA SE ABRE AUNQUE NO HAYA PREMIUM, a propósito: leer para qué sirve el micrófono
          // no es usarlo, y es de las pocas páginas que pueden convencer a alguien de pagar.
          // Lleva la etiqueta para que nadie se lleve la sorpresa al ir a dictar.
          onPress={onVoiceHelp}
          right={
            <View className="bg-amber-50 px-2 py-1 rounded-full">
              <Text className="text-[10px] font-extrabold text-amber-500">PRO</Text>
            </View>
          }
        />
        <Row
          Icon={Lock}
          label={t("lock.rowLabel")}
          onPress={onAppLock}
          right={
            <View className="bg-amber-50 px-2 py-1 rounded-full">
              <Text className="text-[10px] font-extrabold text-amber-500">PRO</Text>
            </View>
          }
        />
        <Row
          Icon={PiggyBank}
          label={t("settings.savingsGoals")}
          onPress={onSavings}
          right={
            <View className="bg-amber-50 px-2 py-1 rounded-full">
              <Text className="text-[10px] font-extrabold text-amber-500">PRO</Text>
            </View>
          }
        />
        {/* EL PAÍS MANDA. Pone el idioma y la moneda de una vez.
            La fila de Idioma se quitó el 03/08/2026 a petición del usuario:
            eligiendo Perú la app tiene que quedar en español y punto, sin un
            segundo ajuste que pueda contradecirlo.

            Lo que se pierde es el caso raro —vivir en Perú y querer la app en
            inglés— y se acepta a cambio de que no pueda quedar una mezcla que
            nadie eligió a propósito. La pantalla de idioma sigue existiendo
            en /language por si algún día se repone. */}
        <Row
          Icon={MapPin}
          label={`${t("settings.country")}${paisActual ? ` · ${t(paisActual.label)}` : ""}`}
          onPress={onCountry}
          right={<ChevronRight size={16} color="#cbd5e1" />}
        />
        <Row
          Icon={Coins}
          label={`${t("settings.currency")} · ${currencyLabelFor(userCurrency, t)}`}
          onPress={onCurrency}
          right={<ChevronRight size={16} color="#cbd5e1" />}
        />
        {/* La fila de Apariencia se quitó: el botón de sol/luna de arriba a la
            derecha hace lo mismo y está a la vista en cuatro pantallas.
            Ahora recorre los tres modos —claro, oscuro y automático—, así que
            no se pierde ninguna opción al quitar esta pantalla. */}
        {/* LA FILA DE "NOTIFICACIONES" SE FUE AL CALENDARIO (21/08/2026).
            Mandaba SOLO sobre los avisos del calendario, pero desde aqui parecia mandar sobre
            todo: la app tiene cuatro cosas que avisan —el calendario, la voz de los yapes, la
            exportacion automatica y las metas— y cada una lleva su propio interruptor donde
            vive. Apagar este creyendo apagarlas todas era una sorpresa esperando.
            Y encima el resto de esos avisos —probarlos, el sonido, cuantos hay puestos— ya
            estaba en el engranaje del calendario: una sola cosa repartida en dos pantallas.
            Ahora esta entera alli. Idea suya. */}
      </View>

      <View className="px-5 mt-5 gap-2.5">
        <Text className="text-xs font-bold text-slate-500 dark:text-slate-300 px-1">{t("settings.sectionAccount")}</Text>
        <Row
          Icon={KeyRound}
          label={t("settings.changePassword")}
          onPress={onChangePassword}
          right={<ChevronRight size={16} color="#cbd5e1" />}
        />
        <Row Icon={UserX} label={t("settings.deleteAccount")} onPress={onDeleteAccount} danger />
        <Row Icon={LogOut} label={t("settings.logout")} onPress={onLogout} danger />
      </View>

      <View className="px-5 mt-5 gap-2.5">
        <Text className="text-xs font-bold text-slate-500 dark:text-slate-300 px-1">{t("settings.sectionInfo")}</Text>
        <Row
          Icon={Info}
          label={t("settings.appInfo")}
          onPress={onAbout}
          right={<ChevronRight size={16} color="#cbd5e1" />}
        />
        <Row
          Icon={Shield}
          label={t("settings.legal")}
          onPress={onLegal}
          right={<ChevronRight size={16} color="#cbd5e1" />}
        />
      </View>
    </ScrollView>
  );
}
