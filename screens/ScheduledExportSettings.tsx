import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Check, ChevronLeft, Cloud, FolderOpen, Info, Package, Play } from "lucide-react-native";
import Toggle from "@/components/Toggle";
import { CARD_SHADOW } from "@/constants/style";
import { useAppData } from "@/contexts/AppDataContext";
import { carpetaElegida, elegirCarpeta } from "@/utils/carpetaTelefono";
import { conectarDropbox, dropboxConectado } from "@/utils/dropbox";
import {
  exportarEnFondo,
  ultimoIntentoEnFondo,
  type UltimoIntento,
} from "@/utils/exportarEnFondo";
import { puedeExportarEnFondo, puedePdfEnFondo } from "@/modules/export-scheduler";
import { flushPendingSaves } from "@/utils/storage";
import {
  DEFAULT_SCHEDULE,
  MAX_MONTH_DAY,
  applySchedule,
  buildFileName,
  loadSchedule,
  monthForSchedule,
  proximaProgramada,
  saveSchedule,
  toDateKey,
  type ExportDestination,
  type ExportFrequency,
  type ScheduledExport,
} from "@/utils/scheduledExport";

const HORAS = [6, 7, 8, 9, 12, 15, 18, 20, 21, 22];

function hhmm(h: number, m: number) {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default function ScheduledExportSettings({ onBack }: { onBack: () => void }) {
  const { t, showToast } = useAppData();
  const insets = useSafeAreaInsets();

  const [schedule, setSchedule] = useState<ScheduledExport>(DEFAULT_SCHEDULE);
  const [loaded, setLoaded] = useState(false);
  // Si el permiso de avisos está dado. Va al resumen del final: es la única
  // línea que la persona no controla desde aquí, y sin ella nada de lo demás
  // sirve.
  const [notifOk, setNotifOk] = useState(true);
  // La hora a mano. Se lleva aparte del ajuste porque mientras se escribe hay
  // estados que no son una hora todavía ("0", vacío), y el ajuste guardado tiene
  // que seguir siendo siempre válido.
  const [horaPersonal, setHoraPersonal] = useState(false);
  const [horaTexto, setHoraTexto] = useState("");
  const [minutoTexto, setMinutoTexto] = useState("");
  /** La carpeta del teléfono ya elegida, para poder enseñar cuál es. */
  const [carpeta, setCarpeta] = useState("");
  /** Si ya hay una cuenta de Dropbox autorizada. */
  const [dropbox, setDropbox] = useState(false);
  /**
   * Si ESTE APK sabe exportar con la app cerrada.
   *
   * Se pregunta porque las actualizaciones por internet no traen código de
   * Android: en un APK anterior al despertador, prometer "sale solo a la hora"
   * sería mentir, y de las mentiras que se descubren solas.
   */
  const [enFondo] = useState(() => puedeExportarEnFondo());
  /**
   * Y si sabe hacer el PDF sin pantalla, que llego despues que el despertador.
   * Los APK 6ago-01 y 6ago-02 traen el despertador pero no el conversor.
   */
  const [pdfEnFondo] = useState(() => puedePdfEnFondo());
  /** Lo último que hizo el trabajo de fondo. Ver abajo por qué se enseña. */
  const [ultimo, setUltimo] = useState<UltimoIntento | null>(null);
  /** Para cuando quedo puesto el despertador. Ver applySchedule. */
  const [proxima, setProxima] = useState(0);
  /**
   * Mientras corre la prueba de verdad.
   *
   * Armar el PDF y subirlo tarda unos segundos, y sin esto el botón se queda
   * igual: se toca otra vez, y otra, y se hacen tres copias del mismo reporte.
   */
  const [probando, setProbando] = useState(false);

  useEffect(() => {
    let alive = true;
    loadSchedule().then((s) => {
      if (!alive) return;
      setSchedule(s);
      setNotifOk(!s.enabled ? true : true);
      // Si la hora guardada no es una en punto de la lista, se abre la casilla
      // de la hora a mano: si no, la pantalla no enseñaría 03:15 en ningún
      // sitio y parecería que se perdió.
      const enLista = s.minute === 0 && HORAS.includes(s.hour);
      setHoraPersonal(!enLista);
      setHoraTexto(String(s.hour).padStart(2, "0"));
      setMinutoTexto(String(s.minute).padStart(2, "0"));
      setLoaded(true);
    });
    carpetaElegida().then((c) => alive && setCarpeta(c));
    dropboxConectado().then((c) => alive && setDropbox(c));
    ultimoIntentoEnFondo().then((u) => alive && setUltimo(u));
    proximaProgramada().then((p) => alive && setProxima(p));
    return () => {
      alive = false;
    };
  }, []);

  /**
   * Lo que se escribe en las casillas de la hora.
   *
   * Se acepta cualquier texto en la casilla —hay que poder borrar para
   * corregir— pero solo se guarda cuando el número cabe en un reloj. Escribir
   * "9" pasando por "" no puede dejar el ajuste en una hora inválida.
   */
  function escribirHora(valor: string, cual: "hora" | "minuto") {
    const soloNumeros = valor.replace(/[^0-9]/g, "");
    if (cual === "hora") setHoraTexto(soloNumeros);
    else setMinutoTexto(soloNumeros);
    if (soloNumeros === "") return;
    const n = Number(soloNumeros);
    if (cual === "hora") {
      if (n >= 0 && n <= 23) update({ hour: n });
    } else if (n >= 0 && n <= 59) {
      update({ minute: n });
    }
  }

  /** Elegir la carpeta del teléfono. Una vez, y el permiso se queda puesto. */
  async function pedirCarpeta() {
    const elegida = await elegirCarpeta();
    if (elegida === "") return;
    setCarpeta(elegida);
    showToast(t("schedExport.folderReady"));
  }

  /** Autorizar Dropbox. Abre el navegador una vez y ya no vuelve a pedir nada. */
  async function conectar() {
    try {
      await conectarDropbox();
      setDropbox(true);
      showToast(t("schedExport.dropboxReady"));
    } catch {
      // Cerrar el navegador a medias entra por aquí, y es lo más normal del
      // mundo: no es un error que merezca alarma, solo "no quedó conectado".
      showToast(t("schedExport.dropboxFailed"));
    }
  }

  // Cada cambio se guarda y se reprograma en el momento. No hay botón de
  // guardar a propósito: una pantalla de ajustes con botón de guardar es una
  // pantalla donde se puede salir creyendo que quedó puesto cuando no. Aquí
  // lo que se ve es lo que está programado.
  async function update(patch: Partial<ScheduledExport>) {
    if (!loaded) return;
    // Cambiar algo aquí BORRA la marca de "ya se hizo".
    //
    // Reconfigurar es decir "quiero que esto pase". Sin esto, quien tocaba la
    // hora después de que ya se hubiera hecho un reporte ese día se quedaba
    // esperando hasta la medianoche sin saber por qué — que es exactamente lo
    // que le pasó al usuario el 06/08/2026, tres intentos seguidos.
    const next = { ...schedule, ...patch, lastAutoRun: undefined };

    // "Personalizado" sin ningún día elegido no programaría nada y la
    // pantalla seguiría diciendo que está activo. Se impide quitar el último.
    if (next.frequency === "custom" && next.customDays.length === 0) {
      showToast(t("schedExport.customEmpty"));
      return;
    }

    setSchedule(next);
    saveSchedule(next);

    // El texto del aviso se fija AHORA y se queda así hasta que se vuelva a
    // programar, así que no puede nombrar el mes: un aviso puesto en julio
    // seguiría diciendo "julio" en diciembre. El mes correcto lo calcula la
    // app al tocar el aviso, no el aviso mismo.
    // El aviso que llega al celular decía "Toca para exportar", y con la
    // exportación en fondo eso es falso: cuando llega, el archivo YA está
    // guardado. Tocarlo abriría la pantalla de exportar e invitaría a hacer una
    // segunda copia del mismo reporte.
    //
    // Se decide aquí y no dentro de applySchedule porque el texto del aviso se
    // fija en el momento de programarlo y se queda así: hay que elegirlo con lo
    // que se sabe ahora, no cuando suene.
    const saldraSolo = enFondo && (next.format !== "pdf" || pdfEnFondo);
    const ok = await applySchedule(next, {
      title: t("schedExport.notifTitle"),
      body: t(saldraSolo ? "schedExport.notifBodyFondo" : "schedExport.notifBody"),
    });
    setNotifOk(ok);

    if (!ok) {
      // Que el permiso falle en silencio sería lo peor que puede pasar aquí:
      // la pantalla mostraría "cada lunes a las 9:00" y no llegaría nunca
      // nada. Se avisa y se apaga el interruptor para que lo que se ve siga
      // siendo verdad.
      showToast(t("schedExport.noPermission"));
      const off = { ...next, enabled: false };
      setSchedule(off);
      saveSchedule(off);
      return;
    }

    if (!next.enabled) showToast(t("schedExport.savedOff"));
    // "Te avisaremos" era del recordatorio, cuando lo único que llegaba era un
    // aviso. Decirlo ahora contradice a la propia pantalla: el usuario lo leyó
    // justo debajo de un cuadro que dice "se guarda solo". Si de verdad se
    // exporta solo, el mensaje tiene que decir eso.
    else if (saleSolo) showToast(t("schedExport.savedFondo", { when: describir(next) }));
    else showToast(t("schedExport.saved", { when: describir(next) }));
  }

  function toggleDay(d: number) {
    const puestos = schedule.customDays.includes(d)
      ? schedule.customDays.filter((x) => x !== d)
      : [...schedule.customDays, d].sort();
    update({ customDays: puestos });
  }

  function describir(s: ScheduledExport): string {
    const time = hhmm(s.hour, s.minute);
    if (s.frequency === "daily") return t("schedExport.whenDaily", { time });
    if (s.frequency === "monthly") return t("schedExport.whenMonthly", { day: String(s.day), time });
    const dias =
      s.frequency === "weekly"
        ? t(`weekday.${s.weekday}`)
        : s.customDays.map((d) => t(`weekday.short.${d}`)).join(", ");
    return t("schedExport.whenWeekly", { day: dias, time });
  }

  const typeLabel =
    schedule.type === "expense"
      ? t("exportPdf.expenses")
      : schedule.type === "income"
        ? t("exportPdf.income")
        : t("exportPdf.all");

  // El nombre que va a tener el archivo, calculado igual que lo hará el
  // exportador. Se enseña debajo del campo para que nadie tenga que exportar
  // para descubrir cómo quedó.
  const nombreArchivo = useMemo(
    () =>
      buildFileName({
        mode: schedule.fileNameMode,
        custom: schedule.fileName,
        typeLabel,
        dateKey: toDateKey(new Date()),
        extension: schedule.format,
      }),
    [schedule.fileNameMode, schedule.fileName, schedule.format, typeLabel]
  );

  /**
   * ¿ESTA configuración sale sola con la app cerrada? UNA sola respuesta.
   *
   * Existe porque la pantalla se contradecía: arriba decía "no puede mandarse
   * solo con la app cerrada", en medio "se guarda solo aunque Finzo esté
   * cerrada", y abajo en verde "en cuanto abras Finzo". Tres textos, tres
   * versiones, y el usuario leyendo las tres a la vez.
   *
   * Pasó porque cada texto decidía por su cuenta. Ahora todos miran aquí: si
   * mañana cambia la condición —por ejemplo cuando el PDF también pueda—, se
   * cambia en un sitio y los tres se enteran.
   */
  const saleSolo = enFondo && (schedule.format !== "pdf" || pdfEnFondo);

  /**
   * PROBAR AHORA PRUEBA EL CAMINO QUE DE VERDAD VA A CORRER.
   *
   * Antes abría siempre la pantalla de exportar y hacía el archivo con la app
   * delante. Salía bien, y a la hora fijada no llegaba nada: son dos caminos
   * distintos y solo se estaba probando el que no iba a usarse. El usuario lo
   * reportó el 06/08/2026 con el PDF.
   *
   * Ahora: si esta configuración sale sola, se llama al MISMO trabajo que
   * despierta el despertador, forzándolo. Y si no sale sola, se abre la pantalla
   * — porque entonces eso es exactamente lo que va a pasar a la hora.
   */
  async function probarAhora() {
    if (!saleSolo) {
      router.push({
        pathname: "/export-pdf",
        params: {
          month: monthForSchedule(schedule, new Date()),
          format: schedule.format,
          type: schedule.type,
          dest: schedule.destination,
          name: nombreArchivo,
          auto: "1",
        },
      });
      return;
    }

    if (probando) return;
    setProbando(true);
    showToast(t("schedExport.testRunning"));
    // Los ajustes se guardan agrupados con un retardo corto, y el trabajo de
    // fondo los lee DEL DISCO. Sin esto, probar justo después de cambiar la hora
    // o el destino probaría con los valores anteriores.
    await flushPendingSaves();
    const resultado = await exportarEnFondo(true);
    setProbando(false);
    showToast(
      t(resultado === "hecho" ? "schedExport.testOk" : "schedExport.testFail", {
        motivo: t(`schedExport.res.${resultado}`),
      })
    );
    // Se refrescan las dos líneas del resumen: el intento que se acaba de hacer
    // queda ahí escrito, que es lo que se puede leer o mandar en una captura.
    ultimoIntentoEnFondo().then(setUltimo);
    proximaProgramada().then(setProxima);
  }

  const FRECUENCIAS: { id: ExportFrequency; label: string }[] = [
    { id: "daily", label: t("schedExport.daily") },
    { id: "weekly", label: t("schedExport.weekly") },
    { id: "monthly", label: t("schedExport.monthly") },
    { id: "custom", label: t("schedExport.custom") },
  ];

  // Tipado a mano y no con "as const": al meter Gmail con un condicional, el
  // "as const" se pierde y los identificadores vuelven a ser un string
  // cualquiera, con lo que update({ destination }) dejaría pasar cualquier
  // texto.
  // SOLO LOS DESTINOS QUE SE HACEN SOLOS.
  //
  // Estaban también compartir, correo, Gmail y WhatsApp, y los cuatro abren
  // otra aplicación y esperan a que una persona toque enviar — o sea, no son
  // automáticos. Se quitaron el 05/08/2026 a pedido del usuario. Para exportar
  // a mano siguen estando todos, en la pantalla de exportar.
  const DESTINOS: { id: ExportDestination; label: string; Icon: typeof Cloud }[] = [
    { id: "folder", label: t("schedExport.destFolder"), Icon: FolderOpen },
    { id: "drive", label: t("exportPdf.destDrive"), Icon: Cloud },
    { id: "dropbox", label: t("schedExport.destDropbox"), Icon: Package },
  ];

  const destLabel = DESTINOS.find((d) => d.id === schedule.destination)?.label ?? "";
  const freqLabel = FRECUENCIAS.find((f) => f.id === schedule.frequency)?.label ?? "";

  return (
    <View className="flex-1 bg-white dark:bg-slate-900" style={{ paddingTop: insets.top }}>
      <View className="px-5 pt-3 pb-2 flex-row items-center gap-2">
        <TouchableOpacity onPress={onBack} className="w-9 h-9 items-center justify-center -ml-2">
          <ChevronLeft size={24} color="#94a3b8" />
        </TouchableOpacity>
        <Text className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
          {t("schedExport.title")}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}>
        {/* EL INTERRUPTOR PRINCIPAL.
            Va primero y solo. Antes la pantalla arrancaba directamente con
            las opciones y había que buscar "Nunca" entre las frecuencias
            para apagarlo: apagar algo no debería estar escondido dentro de
            la lista de cómo encenderlo. */}
        <View
          className="rounded-2xl border-[1.5px] border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 mb-4 flex-row items-center gap-3"
          style={CARD_SHADOW}
        >
          <View className="flex-1">
            <Text className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
              {t("schedExport.masterLabel")}
            </Text>
            <Text
              className={`text-xs font-semibold mt-0.5 ${
                schedule.enabled ? "text-emerald-600" : "text-slate-400 dark:text-slate-500"
              }`}
            >
              {schedule.enabled ? t("schedExport.on") : t("schedExport.off")}
            </Text>
          </View>
          <Toggle on={schedule.enabled} onChange={(v: boolean) => update({ enabled: v })} />
        </View>

        {/* QUÉ HACE Y QUÉ NO.
            Alguien que activa esto espera que le llegue el archivo solo. Si eso
            no va a pasar, tiene que saberlo ANTES de confiar en ello y no un mes
            después. Y si SÍ va a pasar, decir lo contrario es igual de malo:
            este cuadro decía que no se podía cuando ya se podía. */}
        <View className="rounded-2xl border-[1.5px] border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4 mb-5">
          <View className="flex-row gap-2.5">
            <Info size={16} color="#64748b" />
            <Text className="flex-1 text-xs text-slate-600 dark:text-slate-300 leading-5">
              {t(saleSolo ? "schedExport.explainFondo" : "schedExport.explain")}
            </Text>
          </View>
          {!saleSolo && (
            <Text className="text-[11px] text-slate-500 dark:text-slate-400 leading-4 mt-2.5 pl-[26px]">
              {t("schedExport.whyNotFull")}
            </Text>
          )}
        </View>

        {schedule.enabled && (
          <>
            <Text className="text-xs font-semibold text-slate-600 dark:text-slate-200 mb-1.5">
              {t("schedExport.freqLabel")}
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-5">
              {FRECUENCIAS.map((f) => (
                <TouchableOpacity
                  key={f.id}
                  onPress={() => update({ frequency: f.id })}
                  className={`px-4 py-2.5 rounded-xl border-[1.5px] ${
                    schedule.frequency === f.id
                      ? "bg-emerald-600 border-emerald-600"
                      : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <Text
                    className={`text-sm font-bold ${
                      schedule.frequency === f.id ? "text-white" : "text-slate-600 dark:text-slate-200"
                    }`}
                  >
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {schedule.frequency === "weekly" && (
              <>
                <Text className="text-xs font-semibold text-slate-600 dark:text-slate-200 mb-1.5">
                  {t("schedExport.weekdayLabel")}
                </Text>
                <View className="flex-row gap-1.5 mb-5">
                  {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                    <TouchableOpacity
                      key={d}
                      onPress={() => update({ weekday: d })}
                      className={`flex-1 py-2.5 rounded-xl border-[1.5px] items-center ${
                        schedule.weekday === d
                          ? "bg-emerald-600 border-emerald-600"
                          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      <Text
                        className={`text-[11px] font-bold ${
                          schedule.weekday === d ? "text-white" : "text-slate-600 dark:text-slate-200"
                        }`}
                      >
                        {t(`weekday.short.${d}`)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* PERSONALIZADO: varios días de la semana.
                Se hace así y no con un "cada N días" porque un "cada 3 días"
                se cuenta desde el momento de programarlo: se va corriendo por
                el calendario y se reinicia cada vez que se toca cualquier
                ajuste. Elegir días concretos cae siempre donde se espera. */}
            {schedule.frequency === "custom" && (
              <>
                <Text className="text-xs font-semibold text-slate-600 dark:text-slate-200 mb-1.5">
                  {t("schedExport.customLabel")}
                </Text>
                <View className="flex-row gap-1.5 mb-5">
                  {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                    const puesto = schedule.customDays.includes(d);
                    return (
                      <TouchableOpacity
                        key={d}
                        onPress={() => toggleDay(d)}
                        className={`flex-1 py-2.5 rounded-xl border-[1.5px] items-center ${
                          puesto
                            ? "bg-emerald-600 border-emerald-600"
                            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        <Text
                          className={`text-[11px] font-bold ${
                            puesto ? "text-white" : "text-slate-600 dark:text-slate-200"
                          }`}
                        >
                          {t(`weekday.short.${d}`)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {schedule.frequency === "monthly" && (
              <>
                <Text className="text-xs font-semibold text-slate-600 dark:text-slate-200 mb-1.5">
                  {t("schedExport.dayLabel")}
                </Text>
                {/* Solo hasta el 28. Febrero no tiene 29, 30 ni 31, y un
                    aviso puesto en un día que no existe no llega: no falla,
                    simplemente no ocurre ese mes. */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 6, paddingRight: 8 }}
                  className="mb-5"
                >
                  {Array.from({ length: MAX_MONTH_DAY }, (_, i) => i + 1).map((d) => (
                    <TouchableOpacity
                      key={d}
                      onPress={() => update({ day: d })}
                      className={`w-11 py-2.5 rounded-xl border-[1.5px] items-center ${
                        schedule.day === d
                          ? "bg-emerald-600 border-emerald-600"
                          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          schedule.day === d ? "text-white" : "text-slate-600 dark:text-slate-200"
                        }`}
                      >
                        {d}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            <Text className="text-xs font-semibold text-slate-600 dark:text-slate-200 mb-1.5">
              {t("schedExport.timeLabel")}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, paddingRight: 8 }}
              className="mb-2.5"
            >
              {/* "Otra hora" va PRIMERA, y no es capricho: la fila se desliza y
                  detrás de las diez horas en punto queda fuera de la pantalla.
                  Puesta al final, el usuario no la encontró — "añade una opción
                  para colocar cualquier hora", cuando ya estaba. */}
              <TouchableOpacity
                onPress={() => setHoraPersonal(true)}
                className={`px-3.5 py-2.5 rounded-xl border-[1.5px] ${
                  horaPersonal
                    ? "bg-emerald-600 border-emerald-600"
                    : "bg-white dark:bg-slate-800 border-dashed border-slate-400 dark:border-slate-500"
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    horaPersonal ? "text-white" : "text-slate-600 dark:text-slate-200"
                  }`}
                >
                  {t("schedExport.timeCustom")}
                </Text>
              </TouchableOpacity>
              {HORAS.map((h) => {
                // Una hora en punto solo está elegida si los minutos son 0. Sin
                // mirar el minuto, poner 03:15 dejaría "03:00" resaltado.
                const elegida = !horaPersonal && schedule.hour === h && schedule.minute === 0;
                return (
                  <TouchableOpacity
                    key={h}
                    onPress={() => {
                      setHoraPersonal(false);
                      update({ hour: h, minute: 0 });
                    }}
                    className={`px-3.5 py-2.5 rounded-xl border-[1.5px] ${
                      elegida
                        ? "bg-emerald-600 border-emerald-600"
                        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        elegida ? "text-white" : "text-slate-600 dark:text-slate-200"
                      }`}
                    >
                      {hhmm(h, 0)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* LA HORA A MANO. Dos casillas y no un texto libre: escribir
                "3:15 pm" o "315" es más fácil que acertar el formato, y una
                hora que no se entiende deja el aviso sin programar en silencio.
                Se guarda solo cuando el número es válido; mientras se está
                escribiendo, el ajuste no se toca. */}
            {horaPersonal && (
              <View className="flex-row items-center gap-2 mb-5">
                <TextInput
                  value={horaTexto}
                  onChangeText={(v) => escribirHora(v, "hora")}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="03"
                  placeholderTextColor="#94a3b8"
                  className="w-16 text-center border-[1.5px] border-slate-200 dark:border-slate-700 rounded-xl py-2.5 text-sm font-bold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800"
                />
                <Text className="text-lg font-extrabold text-slate-400">:</Text>
                <TextInput
                  value={minutoTexto}
                  onChangeText={(v) => escribirHora(v, "minuto")}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="15"
                  placeholderTextColor="#94a3b8"
                  className="w-16 text-center border-[1.5px] border-slate-200 dark:border-slate-700 rounded-xl py-2.5 text-sm font-bold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800"
                />
                <Text className="text-[11px] text-slate-500 dark:text-slate-400 flex-1">
                  {t("schedExport.timeCustomHint")}
                </Text>
              </View>
            )}

            {/* QUÉ PASA A ESA HORA, dicho debajo de la hora.
                El usuario preguntó "¿debería exportar automáticamente a la hora
                que le puse?" con todo ya configurado, y es la pregunta correcta:
                en ningún sitio se decía. Las notas de cada destino lo explicaban
                a medias y encima se contradecían — decían "automático del todo"
                y "la próxima vez que abras Finzo" en la misma frase. */}
            <View className="rounded-xl bg-slate-50 dark:bg-slate-800 border-[1.5px] border-slate-200 dark:border-slate-700 p-3.5 mb-5 flex-row gap-2.5">
              <Info size={15} color="#64748b" />
              <View className="flex-1">
                <Text className="text-[11px] leading-5 text-slate-600 dark:text-slate-300">
                  {/* Con el despertador de Android sale solo; sin él, al abrir la
                      app. Son dos promesas distintas y hay que decir la que
                      corresponde a ESTE celular: quien tenga un APK anterior
                      recibe el texto nuevo y no la función. */}
                  {t(
                    enFondo && schedule.format !== "pdf"
                      ? "schedExport.fondoSi"
                      : "schedExport.timeWhatHappens"
                  )}
                </Text>
                {/* Y el PDF no se puede armar con la app cerrada, así que quien
                    tenga el despertador y elija PDF tiene que saberlo aquí, al
                    elegirlo, y no descubrirlo por un reporte que no llega. */}
                {/* El "!pdfEnFondo" es la corrección de una contradicción que
                    duró un rato: con el APK que SÍ sabe hacer el PDF sin
                    pantalla, este aviso salía igual, así que la pantalla decía
                    "se guarda solo" y "el PDF no se puede" a la vez. Es el mismo
                    fallo de tener dos textos decidiendo por su cuenta. */}
                {enFondo && schedule.format === "pdf" && !pdfEnFondo && (
                  <Text className="text-[11px] leading-5 text-amber-700 dark:text-amber-300 mt-1.5">
                    {t("schedExport.fondoNoPdf")}
                  </Text>
                )}
                {/* LO ÚLTIMO QUE PASÓ.
                    Un trabajo de fondo sin esto es imposible de arreglar: "no
                    llegó nada" se ve igual con diez causas distintas. Es la
                    misma lección que dejó el registro de la captura de yapes. */}
                {/* PARA CUÁNDO QUEDÓ PUESTO. Es la línea que resuelve de una
                    la duda de "puse la hora y no llegó nada": si dice mañana,
                    ya está contestado. */}
                {saleSolo && proxima > 0 && (
                  <Text className="text-[11px] leading-5 text-slate-500 dark:text-slate-400 mt-1.5">
                    {t("schedExport.proxima", { cuando: new Date(proxima).toLocaleString() })}
                  </Text>
                )}
                {ultimo && (
                  <Text className="text-[11px] leading-5 text-slate-500 dark:text-slate-400 mt-1.5">
                    {t("schedExport.ultimoIntento", {
                      cuando: new Date(ultimo.cuando).toLocaleString(),
                      resultado: t(`schedExport.res.${ultimo.resultado}`),
                    })}
                  </Text>
                )}
              </View>
            </View>

            <Text className="text-xs font-semibold text-slate-600 dark:text-slate-200 mb-1.5">
              {t("exportPdf.formatLabel")}
            </Text>
            <View className="flex-row gap-2.5 mb-5">
              {([
                { id: "pdf", label: "PDF" },
                { id: "xlsx", label: "Excel" },
                { id: "csv", label: "CSV" },
              ] as const).map((f) => (
                <TouchableOpacity
                  key={f.id}
                  onPress={() => update({ format: f.id })}
                  className={`flex-1 py-3 rounded-xl border-[1.5px] items-center ${
                    schedule.format === f.id
                      ? "bg-emerald-600 border-emerald-600"
                      : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <Text
                    className={`text-sm font-bold ${
                      schedule.format === f.id ? "text-white" : "text-slate-600 dark:text-slate-200"
                    }`}
                  >
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="text-xs font-semibold text-slate-600 dark:text-slate-200 mb-1.5">
              {t("exportPdf.typeLabel")}
            </Text>
            <View className="bg-slate-100 dark:bg-slate-800 rounded-xl p-1 flex-row mb-5">
              {([
                { id: "all", label: t("exportPdf.all") },
                { id: "expense", label: t("exportPdf.expenses") },
                { id: "income", label: t("exportPdf.income") },
              ] as const).map((o) => (
                <TouchableOpacity
                  key={o.id}
                  onPress={() => update({ type: o.id })}
                  className={`flex-1 py-2.5 rounded-xl items-center ${
                    schedule.type === o.id ? "bg-emerald-600" : ""
                  }`}
                >
                  <Text
                    className={`text-sm font-bold ${
                      schedule.type === o.id ? "text-white" : "text-slate-500 dark:text-slate-300"
                    }`}
                  >
                    {o.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* NOMBRE DEL ARCHIVO.
                En automático la fecha va al final y en formato año-mes-día:
                así, al ordenar por nombre en Drive o en el explorador, los
                archivos quedan en orden cronológico solos. */}
            <Text className="text-xs font-semibold text-slate-600 dark:text-slate-200 mb-1.5">
              {t("schedExport.fileNameLabel")}
            </Text>
            <View className="flex-row gap-2.5 mb-2.5">
              {([
                { id: "auto", label: t("schedExport.fileAuto") },
                { id: "custom", label: t("schedExport.fileCustom") },
              ] as const).map((o) => (
                <TouchableOpacity
                  key={o.id}
                  onPress={() => update({ fileNameMode: o.id })}
                  className={`flex-1 py-3 rounded-xl border-[1.5px] items-center ${
                    schedule.fileNameMode === o.id
                      ? "bg-emerald-600 border-emerald-600"
                      : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <Text
                    className={`text-sm font-bold ${
                      schedule.fileNameMode === o.id ? "text-white" : "text-slate-600 dark:text-slate-200"
                    }`}
                  >
                    {o.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {schedule.fileNameMode === "custom" && (
              <TextInput
                value={schedule.fileName}
                onChangeText={(v) => {
                  // Se guarda al escribir pero NO se reprograma el aviso en
                  // cada letra: el nombre no cambia cuándo suena. update()
                  // pediría permisos y mostraría un mensajito por cada tecla.
                  const next = { ...schedule, fileName: v };
                  setSchedule(next);
                  saveSchedule(next);
                }}
                placeholder={t("schedExport.filePlaceholder")}
                placeholderTextColor="#94a3b8"
                maxLength={60}
                className="border-[1.5px] border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 mb-2"
              />
            )}

            <Text className="text-[11px] text-slate-500 dark:text-slate-400 mb-5">
              {t("schedExport.filePreview", { name: nombreArchivo })}
            </Text>

            <Text className="text-xs font-semibold text-slate-600 dark:text-slate-200 mb-1.5">
              {t("exportPdf.destinationLabel")}
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-3">
              {DESTINOS.map((o) => (
                <TouchableOpacity
                  key={o.id}
                  onPress={() => update({ destination: o.id })}
                  className={`flex-row items-center gap-1.5 px-3.5 py-3 rounded-xl border-[1.5px] ${
                    schedule.destination === o.id
                      ? "bg-emerald-600 border-emerald-600"
                      : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <o.Icon size={15} color={schedule.destination === o.id ? "#ffffff" : "#64748b"} />
                  <Text
                    className={`text-xs font-bold ${
                      schedule.destination === o.id ? "text-white" : "text-slate-600 dark:text-slate-200"
                    }`}
                  >
                    {o.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Drive es el único destino que puede funcionar solo, porque no
                necesita que nadie elija a quién mandarlo. Se dice justo aquí,
                al elegirlo, y no en un texto de ayuda general. */}
            {schedule.destination === "drive" && (
              <View className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border-[1.5px] border-emerald-600 p-3.5 mb-5">
                <Text className="text-xs text-emerald-800 dark:text-emerald-200 leading-5">
                  {t(saleSolo ? "schedExport.destinoFondo" : "schedExport.driveNote")}
                </Text>
              </View>
            )}

            {/* LA CARPETA. Hay que elegirla una vez o el reporte no tendrá dónde
                ir, y ese fallo llegaría a la hora del reporte, sin nadie
                mirando. Así que si falta, se pide aquí y en rojo. */}
            {schedule.destination === "folder" && (
              <View
                className={`rounded-xl border-[1.5px] p-3.5 mb-5 ${
                  carpeta === ""
                    ? "bg-amber-50 dark:bg-amber-900/20 border-amber-500"
                    : "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-600"
                }`}
              >
                <Text
                  className={`text-xs leading-5 ${
                    carpeta === ""
                      ? "text-amber-800 dark:text-amber-200"
                      : "text-emerald-800 dark:text-emerald-200"
                  }`}
                >
                  {carpeta === ""
                    ? t("schedExport.folderMissing")
                    : t(saleSolo ? "schedExport.destinoFondo" : "schedExport.folderNote")}
                </Text>
                <TouchableOpacity
                  onPress={pedirCarpeta}
                  className="mt-2.5 py-2.5 rounded-xl items-center bg-slate-900 dark:bg-white"
                >
                  <Text className="text-xs font-extrabold text-white dark:text-slate-900">
                    {t(carpeta === "" ? "schedExport.folderChoose" : "schedExport.folderChange")}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* DROPBOX. Igual que la carpeta: hay que autorizar una vez, y si
                falta hay que decirlo aquí y no a la hora del reporte. */}
            {schedule.destination === "dropbox" && (
              <View
                className={`rounded-xl border-[1.5px] p-3.5 mb-5 ${
                  dropbox
                    ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-600"
                    : "bg-amber-50 dark:bg-amber-900/20 border-amber-500"
                }`}
              >
                <Text
                  className={`text-xs leading-5 ${
                    dropbox
                      ? "text-emerald-800 dark:text-emerald-200"
                      : "text-amber-800 dark:text-amber-200"
                  }`}
                >
                  {t(
                    !dropbox
                      ? "schedExport.dropboxMissing"
                      : saleSolo
                        ? "schedExport.destinoFondo"
                        : "schedExport.dropboxNote"
                  )}
                </Text>
                {!dropbox && (
                  <TouchableOpacity
                    onPress={conectar}
                    className="mt-2.5 py-2.5 rounded-xl items-center bg-slate-900 dark:bg-white"
                  >
                    <Text className="text-xs font-extrabold text-white dark:text-slate-900">
                      {t("schedExport.dropboxConnect")}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* RESUMEN.
                Antes solo se veía "cada día a las 09:00", y eso deja fuera el
                formato, qué exporta y a dónde va — que es justo lo que se
                olvida entre una visita y la siguiente. */}
            <View
              className="rounded-2xl border-[1.5px] border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4 mb-4"
              style={CARD_SHADOW}
            >
              <Text className="text-xs font-extrabold text-slate-900 dark:text-slate-100 mb-2.5">
                {t("schedExport.summaryTitle")}
              </Text>
              {[
                freqLabel,
                hhmm(schedule.hour, schedule.minute),
                schedule.format === "pdf" ? "PDF" : schedule.format === "xlsx" ? "Excel" : "CSV",
                typeLabel,
                destLabel,
                nombreArchivo,
                notifOk ? t("schedExport.summaryNotif") : t("schedExport.summaryNoNotif"),
              ].map((linea, i) => (
                <View key={i} className="flex-row items-center gap-2 py-1">
                  <Check size={14} color={i === 6 && !notifOk ? "#e11d48" : "#059669"} />
                  <Text
                    className={`flex-1 text-xs ${
                      i === 6 && !notifOk
                        ? "text-rose-500 font-semibold"
                        : "text-slate-700 dark:text-slate-200"
                    }`}
                    numberOfLines={1}
                  >
                    {linea}
                  </Text>
                </View>
              ))}
              <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                {describir(schedule)}
              </Text>
            </View>

            {/* PROBAR AHORA.
                Sin esto, comprobar que la configuración funciona significaba
                esperar al día siguiente a las 9:00. Y si estaba mal, otro día
                más. */}
            <TouchableOpacity
              onPress={probarAhora}
              disabled={probando}
              className={`w-full py-4 rounded-2xl items-center flex-row justify-center gap-2 border-[1.5px] ${
                probando
                  ? "border-slate-300 bg-slate-100 dark:border-slate-600 dark:bg-slate-800"
                  : "border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20"
              }`}
            >
              <Play size={17} color={probando ? "#94a3b8" : "#059669"} />
              <Text
                className={`font-extrabold ${
                  probando ? "text-slate-400" : "text-emerald-700 dark:text-emerald-300"
                }`}
              >
                {t(probando ? "schedExport.testRunning" : "schedExport.testNow")}
              </Text>
            </TouchableOpacity>
            <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 text-center">
              {/* Dos avisos distintos porque son dos pruebas distintas: la de
                  verdad no abre nada y el archivo aparece en el destino, y quien
                  espere ver la pantalla de exportar creerá que no funcionó. */}
              {t(saleSolo ? "schedExport.testHintFondo" : "schedExport.testHint")}
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}
