import { useEffect, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View,
  Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ShieldCheck, Check, ChevronRight, ChevronDown, Trash2, Smartphone, ArrowDownLeft, ArrowUpRight, AlertTriangle, RotateCcw, Volume2, Store, Wrench } from "lucide-react-native";
import { router } from "expo-router";
import * as notificationReader from "@/modules/notification-reader";
import { useColorScheme } from "nativewind";
import BackButton from "@/components/BackButton";
import Toggle from "@/components/Toggle";
import { useAppData } from "@/contexts/AppDataContext";
import { CARD_SHADOW } from "@/constants/style";
import type { CaptureLogEntry } from "@/utils/autoCapture";
import { horaDe } from "@/utils/format";

// Color con el que se pinta cada resultado en la lista de descartados. Ámbar =
// se reconoció pero no hacía falta; gris = no era un movimiento.
const RESULT_COLOR: Record<CaptureLogEntry["result"], string> = {
  added: "#059669",
  duplicate: "#f59e0b",
  noAmount: "#94a3b8",
  noDirection: "#94a3b8",
  notMoney: "#94a3b8",
};

/**
 * QUÉ ENTRA EN "ÚLTIMOS YAPES" Y QUÉ EN "AVISOS QUE NO ERAN PAGOS".
 *
 * La raya está en si hubo un movimiento de dinero, no en si Fino hizo algo. Un `duplicate`
 * ES un yapeo de verdad —simplemente ya estaba anotado a mano— así que va arriba, con los
 * demás: mandarlo abajo haría que un yapeo real desapareciera de la lista y el usuario
 * pensara que no llegó.
 *
 * Todo lo demás son avisos de Yape que no mueven plata: publicidad, claves, promociones.
 */
function esUnYape(e: CaptureLogEntry): boolean {
  return e.result === "added" || e.result === "duplicate";
}

function fmtTime(ms: number): string {
  const d = new Date(ms);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month} ${hh}:${mm}`;
}

/**
 * CUÁNDO LLEGÓ, EN LENGUAJE DE PERSONA.
 *
 * "hace 5 min" contesta la pregunta real —*¿acaba de entrar el que me hicieron?*— mucho
 * mejor que "18/08 16:10", que obliga a mirar el reloj y restar. Pasadas las horas deja de
 * aportar y se vuelve a la fecha, que es lo que sirve para buscar.
 *
 * Se calcula con `ahora` recibido de fuera y no con `Date.now()` dentro: así todas las filas
 * de un mismo dibujado usan el mismo instante y no puede pasar que la de arriba diga "hace
 * 1 min" y la de abajo, calculada un milisegundo después, diga otra cosa.
 */
function cuando(at: number, ahora: number, t: (k: string, v?: Record<string, string | number>) => string): string {
  const min = Math.floor((ahora - at) / 60000);
  if (min < 1) return t("autoCapture.cuandoAhora");
  if (min < 60) return t("autoCapture.cuandoMin", { n: min });
  const d = new Date(at);
  const hoy = new Date(ahora);
  const mismoDia = d.toDateString() === hoy.toDateString();
  if (mismoDia) return horaDe(at);
  const ayer = new Date(ahora - 86400000);
  if (d.toDateString() === ayer.toDateString()) {
    return t("autoCapture.cuandoAyer", { hora: horaDe(at) });
  }
  return fmtTime(at);
}

export default function AutoCapture({ onBack }: { onBack: () => void }) {
  const {
    t,
    fmt,
    autoCaptureSupported,
    autoCapturePermission,
    autoCaptureOn,
    setAutoCaptureOn,
    openAutoCaptureSettings,
    autoCaptureLog,
    clearAutoCaptureLog,
    negocios,
  } = useAppData();
  /**
   * ¿HAY UN NEGOCIO QUEDÁNDOSE CON LOS YAPEOS QUE ENTRAN?
   *
   * Esta pantalla existe para responder *"¿por qué no me entró el yapeo?"*, y desde el Modo
   * Negocio hay una respuesta nueva que antes no existía: **sí entró, pero a la caja del
   * negocio**. Sin decirlo aquí, quien no lo vea en Inicio va a pensar que se perdió — y esta
   * es justo la pantalla a la que se viene a comprobarlo.
   *
   * Ya pasó con la voz y con el lector: la pantalla de diagnóstico tenía la respuesta y no la
   * enseñaba.
   */
  const negocioQueRecibe = negocios.find((n) => n.activo && n.destinoYapes === "negocio");
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const iconColor = colorScheme === "dark" ? "#94a3b8" : "#334155";

  // Estado real del servicio de Android. Se refresca al entrar y cada 3
  // segundos mientras la pantalla esté abierta, para poder hacer un Yape,
  // volver, y ver si el contador subió sin tener que salir y entrar.
  const [stats, setStats] = useState(() => notificationReader.stats());
  // Los dos interruptores de la voz. Se leen del lado nativo, que es donde
  // viven: el servicio los consulta aunque Fino este cerrada.
  const [hablar, setHablar] = useState(() => notificationReader.isSpeakEnabled());
  const [hablarSalidas, setHablarSalidas] = useState(() => notificationReader.isSpeakOutgoing());
  /**
   * LO QUE VA DETRÁS DE UN TOQUE, Y POR QUÉ SON TRES Y NO UNO.
   *
   * Rediseño del 18/08/2026, pedido así: *"siento que tiene mucho texto y muchas cosas de
   * más; el usuario normal solo quiere usarlo y no leer todo o complicarse por averiguar
   * cada botón"*.
   *
   * Cada uno se abre solo, sin cerrar a los otros: quien está arreglando la voz suele tener
   * abierto también el diagnóstico, y cerrárselo al tocar el otro sería pelearse con él.
   */
  const [verDescartados, setVerDescartados] = useState(false);
  const [verQueSeLee, setVerQueSeLee] = useState(false);
  const [verAyuda, setVerAyuda] = useState(false);
  // Ver `cuando`: un solo instante para todas las filas del mismo dibujado.
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    if (!autoCaptureSupported) return;
    const timer = setInterval(() => {
      setStats(notificationReader.stats());
      setAhora(Date.now());
    }, 3000);
    return () => clearInterval(timer);
  }, [autoCaptureSupported]);

  // Las más recientes arriba.
  const log = [...autoCaptureLog].reverse();
  const yapes = log.filter(esUnYape);
  const descartados = log.filter((e) => !esUnYape(e));

  /**
   * EN QUÉ ESTADO ESTÁ TODO, EN UNA SOLA PALABRA.
   *
   * Antes la pantalla enseñaba las piezas —permiso, interruptor, servicio— y dejaba que cada
   * quien dedujera si aquello funcionaba. Son tres cosas que hay que mirar y entender, y la
   * pregunta de quien entra aquí es una sola: *¿está funcionando o no?*
   *
   * **El orden importa y es el de la cadena real:** sin permiso el interruptor no hace nada,
   * y con el interruptor apagado da igual que el servicio esté enganchado. Enseñar el
   * problema de más abajo cuando el de más arriba sigue sin resolver manda a arreglar lo que
   * no toca.
   */
  const estado: "listo" | "sin-permiso" | "apagado" | "desconectado" = !autoCapturePermission
    ? "sin-permiso"
    : !autoCaptureOn
      ? "apagado"
      : !stats.connected
        ? "desconectado"
        : "listo";
  const todoBien = estado === "listo";

  // El motivo llega del servicio como una palabra suelta ("sin-monto") para
  // no depender del idioma: la traducción se hace aquí.
  const MOTIVOS_VOZ: Record<string, string> = {
    hablo: "autoCapture.speak.hablo",
    apagado: "autoCapture.speak.apagado",
    "sin-monto": "autoCapture.speak.sinMonto",
    "es-salida": "autoCapture.speak.esSalida",
    // Nuevo el 07/08/2026: el aviso trae un monto pero no dice si el dinero entra o
    // sale, así que no es un movimiento. Es el motivo de la publicidad de préstamos.
    // Sin esta línea el motivo llegaría y la pantalla lo mostraría en blanco.
    "sin-direccion": "autoCapture.speak.sinDireccion",
    "no-es-movimiento": "autoCapture.speak.noEsMovimiento",
    "sin-texto": "autoCapture.speak.sinTexto",
    error: "autoCapture.speak.error",
  };
  const claveVoz = MOTIVOS_VOZ[stats.lastSpeak];
  // CON LA HORA. Sin ella el motivo no sirve para lo que se hizo: al mirarlo
  // no se sabe si habla del aviso que se acaba de recibir o de uno de hace
  // media hora, que es justo la pregunta que hay que responder.
  const motivoVoz = claveVoz
    ? t(claveVoz) + (stats.lastSpeakAt > 0 ? ` · ${horaDe(stats.lastSpeakAt)}` : "")
    : "";

  return (
    <View
      className="flex-1 bg-white dark:bg-slate-900"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <View className="flex-row items-center justify-between px-5 pt-2 pb-4">
        <BackButton onPress={onBack} />
        <Text className="text-base font-bold text-slate-900 dark:text-slate-100">
          {t("autoCapture.title")}
        </Text>
        <View className="w-10" />
      </View>

      <ScrollView className="px-5" contentContainerStyle={{ paddingBottom: 32 }}>
        {!autoCaptureSupported ? (
          <View
            className="rounded-2xl p-4 bg-white dark:bg-slate-900 border-[1.5px] border-slate-200 dark:border-slate-700"
            style={CARD_SHADOW}
          >
            <View className="flex-row items-center gap-2 mb-2">
              <Smartphone size={16} color={iconColor} />
              <Text className="text-xs font-bold text-slate-900 dark:text-slate-100">
                {t("autoCapture.unsupportedTitle")}
              </Text>
            </View>
            <Text className="text-[11px] leading-5 text-slate-500 dark:text-slate-300">
              {t("autoCapture.unsupportedBody")}
            </Text>
          </View>
        ) : (
          <>
            {/* EL ESTADO, Y NADA MÁS QUE EL ESTADO.
                Este bloque reemplaza al texto de arriba, al recuadro de privacidad, a los dos
                pasos numerados y a la tarjeta del servicio: cinco cosas que había que leer
                para contestar una sola pregunta. Cuando todo va bien dice "Todo listo" y se
                acabó; cuando algo falla dice QUÉ falta y trae el botón que lo arregla.

                El botón va DENTRO del bloque a propósito: el error y su arreglo separados es
                justo lo que hacía que la gente leyera "desconectado" y no supiera qué hacer. */}
            {todoBien ? (
              <View className="rounded-2xl p-5 mb-5 items-center bg-emerald-50 dark:bg-emerald-950/40">
                <Check size={30} color="#059669" />
                <Text className="text-sm font-bold text-emerald-800 dark:text-emerald-300 mt-2">
                  {t("autoCapture.listoTitulo")}
                </Text>
                <Text className="text-[11px] leading-5 text-emerald-700 dark:text-emerald-400 mt-1 text-center">
                  {t("autoCapture.listoTexto")}
                </Text>
              </View>
            ) : (
              <View className="rounded-2xl p-5 mb-5 items-center bg-amber-50 dark:bg-amber-950/40">
                <AlertTriangle size={28} color="#b45309" />
                <Text className="text-sm font-bold text-amber-900 dark:text-amber-200 mt-2 text-center">
                  {t(`autoCapture.falta.${estado}.titulo`)}
                </Text>
                <Text className="text-[11px] leading-5 text-amber-800 dark:text-amber-300 mt-1 text-center">
                  {t(`autoCapture.falta.${estado}.texto`)}
                </Text>
                {/* "Apagado" no lleva botón: su interruptor está justo debajo, a la vista.
                    Un botón que solo baja la pantalla dos dedos es ruido. */}
                {estado !== "apagado" && (
                  <TouchableOpacity
                    onPress={() => {
                      if (estado === "desconectado") {
                        notificationReader.requestRebind();
                        setStats(notificationReader.stats());
                      } else {
                        openAutoCaptureSettings();
                      }
                    }}
                    className="flex-row items-center justify-center gap-2 py-2.5 px-5 rounded-xl bg-amber-600 mt-3.5"
                  >
                    {estado === "desconectado" && <RotateCcw size={13} color="#ffffff" />}
                    <Text className="text-[11px] font-bold text-white">
                      {t(`autoCapture.falta.${estado}.boton`)}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* A DÓNDE ESTÁN CAYENDO LOS YAPEOS. Ver negocioQueRecibe, arriba: sin esto, un yapeo
                que entró al negocio parece un yapeo perdido, y esta es la pantalla donde se viene
                a mirar. */}
            {negocioQueRecibe && (
              <View
                className="rounded-2xl p-4 mb-5 bg-white dark:bg-slate-900 border-[1.5px] border-emerald-300 dark:border-emerald-700"
                style={CARD_SHADOW}
              >
                <View className="flex-row items-center gap-2 mb-2">
                  <Store size={15} color="#059669" />
                  <Text className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {t("autoCapture.vanAlNegocio", { nombre: negocioQueRecibe.nombre })}
                  </Text>
                </View>
                <Text className="text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                  {t("autoCapture.vanAlNegocioTexto")}
                </Text>
                <TouchableOpacity
                  onPress={() => router.push(`/negocio/${negocioQueRecibe.id}`)}
                  className="mt-3 py-2.5 rounded-xl items-center bg-slate-100 dark:bg-slate-800"
                >
                  <Text className="text-[11px] font-bold text-slate-600 dark:text-slate-200">
                    {t("autoCapture.verNegocio")}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* LOS TRES INTERRUPTORES, JUNTOS Y SIN EXPLICACIÓN DEBAJO.
                Sus nombres ya dicen lo que hacen. El párrafo que llevaba cada uno era la otra
                mitad del texto que sobraba, y ninguno se lee dos veces. */}
            <View
              className="rounded-2xl bg-white dark:bg-slate-900 border-[1.5px] border-slate-200 dark:border-slate-700"
              style={CARD_SHADOW}
            >
              <View className="flex-row items-center justify-between p-4">
                <Text className="text-[13px] font-bold text-slate-900 dark:text-slate-100 flex-1 pr-3">
                  {t("autoCapture.toggleTitle")}
                </Text>
                {autoCapturePermission && <Toggle on={autoCaptureOn} onChange={setAutoCaptureOn} />}
              </View>

              {/* La voz solo si el APK la trae: es código nativo y no llega por
                  actualización. Enseñar un interruptor que no hace nada sería peor. */}
              {notificationReader.canSpeak && (
                <>
                  <View className="flex-row items-center justify-between p-4 border-t-[1.5px] border-slate-100 dark:border-slate-700">
                    <Text className="text-[13px] font-bold text-slate-900 dark:text-slate-100 flex-1 pr-3">
                      {t("autoCapture.speakTitle")}
                    </Text>
                    <Switch
                      value={hablar}
                      onValueChange={(v) => {
                        setHablar(v);
                        notificationReader.setSpeakEnabled(v);
                      }}
                      trackColor={{ true: "#059669", false: "#cbd5e1" }}
                      thumbColor="#ffffff"
                    />
                  </View>

                  {/* La segunda solo tiene sentido con la primera encendida. */}
                  {hablar && (
                    <View className="flex-row items-center justify-between p-4 border-t-[1.5px] border-slate-100 dark:border-slate-700">
                      <Text className="text-[13px] font-bold text-slate-900 dark:text-slate-100 flex-1 pr-3">
                        {t("autoCapture.speakOutTitle")}
                      </Text>
                      <Switch
                        value={hablarSalidas}
                        onValueChange={(v) => {
                          setHablarSalidas(v);
                          notificationReader.setSpeakOutgoing(v);
                        }}
                        trackColor={{ true: "#059669", false: "#cbd5e1" }}
                        thumbColor="#ffffff"
                      />
                    </View>
                  )}
                </>
              )}
            </View>

            {/* ÚLTIMOS YAPES: SOLO LOS QUE MOVIERON PLATA.
                Pedido el 18/08/2026: *"solo debería salir los yapes, no otras notificaciones"*.
                La publicidad de Yape —el crédito preaprobado, la clave autocompletada— ocupaba
                tres renglones cada una en la pantalla de una app de dinero.

                No se borra: baja a "Avisos que no eran pagos". Es la misma regla de siempre en
                este proyecto —esconder no es borrar— y aquí hace falta de verdad: si un yapeo
                dejara de registrarse por confundirse con publicidad, ese es el ÚNICO sitio
                donde se puede ver. */}
            <View className="flex-row items-center justify-between mt-6 mb-2.5 px-1">
              <Text className="text-xs font-bold text-slate-500 dark:text-slate-300">
                {t("autoCapture.yapesTitulo")}
              </Text>
              {log.length > 0 && (
                <TouchableOpacity onPress={clearAutoCaptureLog} className="flex-row items-center gap-1.5">
                  <Trash2 size={13} color="#94a3b8" />
                  <Text className="text-[11px] font-bold text-slate-400">{t("autoCapture.logClear")}</Text>
                </TouchableOpacity>
              )}
            </View>

            <View
              className="rounded-2xl px-4 bg-white dark:bg-slate-900 border-[1.5px] border-slate-200 dark:border-slate-700"
              style={CARD_SHADOW}
            >
              {yapes.length === 0 ? (
                <Text className="text-[11px] leading-5 text-slate-500 dark:text-slate-300 py-4">
                  {t("autoCapture.yapesVacio")}
                </Text>
              ) : (
                yapes.map((entry, i) => (
                  <View
                    key={`${entry.at}-${i}`}
                    className={`flex-row items-center gap-3 py-3.5 ${
                      i > 0 ? "border-t-[1.5px] border-slate-100 dark:border-slate-800" : ""
                    }`}
                  >
                    <View
                      className={`w-9 h-9 rounded-full items-center justify-center ${
                        entry.type === "expense"
                          ? "bg-rose-50 dark:bg-rose-950/40"
                          : "bg-emerald-50 dark:bg-emerald-950/40"
                      }`}
                    >
                      {entry.type === "expense" ? (
                        <ArrowUpRight size={17} color="#e11d48" />
                      ) : (
                        <ArrowDownLeft size={17} color="#059669" />
                      )}
                    </View>
                    <View className="flex-1">
                      {/* Sin nombre —Yape no siempre lo trae— la fila dice "Yape" y no queda
                          un hueco raro donde debería ir una persona. */}
                      <Text className="text-[13px] text-slate-900 dark:text-slate-100" numberOfLines={1}>
                        {entry.name || t("autoCapture.yapeSinNombre")}
                      </Text>
                      <Text className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                        {cuando(entry.at, ahora, t)}
                        {/* "Ya lo tenías" solo se dice cuando es el caso. Sin esta marca, un
                            yapeo que no volvió a sumar parecería sumado dos veces. */}
                        {entry.result === "duplicate" ? ` · ${t("autoCapture.result.duplicate")}` : ""}
                      </Text>
                    </View>
                    {entry.amount != null && (
                      <Text
                        className={`text-[14px] font-bold ${
                          entry.type === "expense" ? "text-rose-600" : "text-emerald-600"
                        }`}
                      >
                        {entry.type === "expense" ? "−" : "+"}
                        {fmt(entry.amount)}
                      </Text>
                    )}
                  </View>
                ))
              )}

              {descartados.length > 0 && (
                <View className="border-t-[1.5px] border-slate-100 dark:border-slate-800">
                  {/* "Descartados" a secas se probó y se cambió antes de entregarlo: en una app
                      de dinero se lee como pagos que no entraron. Dice qué son. */}
                  <TouchableOpacity
                    onPress={() => setVerDescartados((v) => !v)}
                    className="flex-row items-center justify-between py-3.5"
                  >
                    <Text className="text-[11px] text-slate-400 dark:text-slate-500">
                      {t("autoCapture.descartados", { n: descartados.length })}
                    </Text>
                    {verDescartados ? (
                      <ChevronDown size={15} color="#94a3b8" />
                    ) : (
                      <ChevronRight size={15} color="#94a3b8" />
                    )}
                  </TouchableOpacity>

                  {verDescartados &&
                    descartados.map((entry, i) => (
                      <View
                        key={`${entry.at}-${i}`}
                        className="pb-3.5 pt-0.5"
                      >
                        <View className="flex-row items-center justify-between mb-1">
                          <Text
                            className="text-[11px] font-bold"
                            style={{ color: RESULT_COLOR[entry.result] }}
                          >
                            {t(`autoCapture.result.${entry.result}`)}
                          </Text>
                          <Text className="text-[10px] text-slate-400">{fmtTime(entry.at)}</Text>
                        </View>
                        {/* Sin texto = era un aviso de clave. Se anota que llegó,
                            pero su frase no se guarda en el celular. */}
                        <Text
                          className={`text-[11px] leading-4 ${
                            entry.text ? "text-slate-500 dark:text-slate-300" : "italic text-slate-400"
                          }`}
                        >
                          {entry.text || t("autoCapture.logHidden")}
                        </Text>
                      </View>
                    ))}
                </View>
              )}
            </View>

            {/* LO DE CADA DÍA SE ACABÓ AQUÍ. Lo que sigue son las dos puertas de lo que
                antes ocupaba media pantalla todos los días para servir un rato cada mes. */}
            <View className="mt-6">
              <TouchableOpacity
                onPress={() => setVerQueSeLee((v) => !v)}
                className="flex-row items-center justify-between py-3.5 border-b-[1.5px] border-slate-100 dark:border-slate-800"
              >
                <View className="flex-row items-center gap-2.5 flex-1 pr-3">
                  <ShieldCheck size={15} color="#94a3b8" />
                  <Text className="text-xs text-slate-500 dark:text-slate-400">
                    {t("autoCapture.privacyTitle")}
                  </Text>
                </View>
                {verQueSeLee ? (
                  <ChevronDown size={15} color="#94a3b8" />
                ) : (
                  <ChevronRight size={15} color="#94a3b8" />
                )}
              </TouchableOpacity>
              {verQueSeLee && (
                <Text className="text-[11px] leading-5 text-slate-500 dark:text-slate-400 py-3.5">
                  {t("autoCapture.privacyBody")}
                </Text>
              )}

              <TouchableOpacity
                onPress={() => setVerAyuda((v) => !v)}
                className="flex-row items-center justify-between py-3.5"
              >
                <View className="flex-row items-center gap-2.5 flex-1 pr-3">
                  <Wrench size={15} color="#94a3b8" />
                  <Text className="text-xs text-slate-500 dark:text-slate-400">
                    {t("autoCapture.ayudaTitulo")}
                  </Text>
                </View>
                {verAyuda ? (
                  <ChevronDown size={15} color="#94a3b8" />
                ) : (
                  <ChevronRight size={15} color="#94a3b8" />
                )}
              </TouchableOpacity>

              {verAyuda && (
                <View>
                  {/* LOS PASOS DE LA VOZ. Antes salían solos en cuanto la voz estaba
                      encendida, ocupando media pantalla a quien la oía perfectamente. */}
                  {notificationReader.canSpeak && hablar && <PasosDeLaVoz />}

                  {/* EL DIAGNÓSTICO DEL SERVICIO. Cuando no se captura nada hay tres causas
                      posibles y desde fuera se ven idénticas: una pantalla vacía. Estas líneas
                      las separan. "Avisos vistos" cuenta TODAS las notificaciones del celular,
                      de cualquier app, antes de filtrar nada — solo el número, nunca el
                      contenido. */}
                  <View className="rounded-2xl border-[1.5px] border-slate-200 dark:border-slate-700 p-4 mt-4">
                    <Text className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-3">
                      {t("autoCapture.statusTitle")}
                    </Text>

                    <View className="flex-row items-center justify-between mb-2">
                      <Text className="text-[11px] text-slate-500 dark:text-slate-300">
                        {t("autoCapture.statusService")}
                      </Text>
                      <Text
                        className={`text-[11px] font-bold ${
                          stats.connected ? "text-emerald-600" : "text-rose-500"
                        }`}
                      >
                        {t(stats.connected ? "autoCapture.statusOn" : "autoCapture.statusOff")}
                      </Text>
                    </View>

                    <View className="flex-row items-center justify-between">
                      <Text className="text-[11px] text-slate-500 dark:text-slate-300">
                        {t("autoCapture.statusSeen")}
                      </Text>
                      <Text className="text-[11px] font-bold text-slate-900 dark:text-slate-100">
                        {stats.totalSeen}
                      </Text>
                    </View>

                    {stats.lastPackage ? (
                      <Text className="text-[10px] text-slate-400 mt-2" numberOfLines={1}>
                        {t("autoCapture.statusLast", { app: stats.lastPackage })}
                      </Text>
                    ) : null}

                    {/* POR QUÉ HABLÓ O SE CALLÓ. */}
                    {motivoVoz !== "" && (
                      <Text className="text-[10px] text-slate-400 mt-2">
                        {t("autoCapture.speakLast")}: {motivoVoz}
                      </Text>
                    )}

                    <Text className="text-[10px] leading-4 text-slate-400 mt-3">
                      {t(
                        stats.totalSeen === 0
                          ? "autoCapture.statusHelpNone"
                          : stats.queued > 0
                            ? "autoCapture.statusHelpQueued"
                            : "autoCapture.statusHelpSeen"
                      )}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

/**
 * LOS PASOS PARA QUE LA VOZ SE OIGA, CON UN BOTÓN CADA UNO.
 *
 * POR QUÉ EXISTE (07/08/2026)
 *
 * Mandó dos capturas: el servicio decía **Conectado**, el yapeo salía **Registrado**, la
 * voz **encendida**… y no se oyó nada. *"Capaz pueda ser mi celular. Necesito que
 * incorpores en registro automático los pasos que se deben seguir para una correcta
 * funcionamiento para cualquier celular."* Y después: *"como botones que te manden a una
 * pestaña y te diga qué tengas que hacer."*
 *
 * Tenía razón en sospechar del celular, y esa es justo la parte que la app no podía
 * responder. Para que un yapeo se oiga tienen que cumplirse CUATRO cosas, y si falla una
 * el resultado es el mismo —silencio— así que desde fuera no hay forma de saber cuál:
 *
 *   1. El lector de avisos enganchado (eso ya se ve arriba: "Conectado").
 *   2. Un sistema de voz instalado en el celular.
 *   3. Ese sistema con **español**. Casi ningún celular trae el de Perú.
 *   4. El volumen de **avisos** por encima de cero — va aparte del de la música, así que
 *      el celular puede "sonar bien" y tener los avisos mudos.
 *
 * EL BOTÓN QUE IMPORTA ES "PROBAR LA VOZ": dice la frase ahí mismo y responde cuál de las
 * cuatro falta. Es lo único que convierte "no funciona" en "te falta esto", y sin él
 * averiguarlo son días de ir y venir.
 *
 * Los otros botones llevan al ajuste de Android que arregla cada cosa. Si un celular no
 * tiene esa pantalla —cada fabricante las mueve—, el botón lo dice en vez de no hacer nada.
 *
 * **DESDE EL 18/08/2026 VIVE DETRÁS DE "¿ALGO NO FUNCIONA?"** y ya no se dibuja solo por
 * tener la voz encendida. El motivo es el mismo por el que se escribió: son instrucciones
 * para cuando algo falla, y a quien le funciona le ocupaban media pantalla cada día.
 */
function PasosDeLaVoz() {
  const { t } = useAppData();
  const [probando, setProbando] = useState(false);
  const [resultado, setResultado] = useState<notificationReader.ResultadoDeLaVoz | null>(null);
  // Si un ajuste no se pudo abrir, hay que decirlo: un botón que no hace nada al tocarlo
  // parece la app rota.
  const [noSeAbrio, setNoSeAbrio] = useState(false);

  async function probar() {
    setNoSeAbrio(false);
    setProbando(true);
    try {
      setResultado(await notificationReader.probarVoz(t("autoCapture.pasos.frase")));
    } finally {
      setProbando(false);
    }
  }

  function abrir(accion: () => boolean) {
    setNoSeAbrio(!accion());
  }

  return (
    <View className="rounded-2xl border-[1.5px] border-slate-200 dark:border-slate-700 p-4 mt-4">
      <Text className="text-xs font-bold text-slate-700 dark:text-slate-200">
        {t("autoCapture.pasos.titulo")}
      </Text>
      <Text className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mt-1">
        {t("autoCapture.pasos.intro")}
      </Text>

      {/* PRIMERO PROBAR, Y DESPUÉS ARREGLAR. Al revés se acaba cambiando ajustes que
          estaban bien. */}
      <TouchableOpacity
        onPress={probar}
        disabled={probando}
        className="flex-row items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 mt-3.5"
      >
        <Volume2 size={15} color="#ffffff" />
        <Text className="text-xs font-bold text-white">
          {t(probando ? "autoCapture.pasos.probando" : "autoCapture.pasos.probar")}
        </Text>
      </TouchableOpacity>

      {resultado !== null && (
        <View
          className={`rounded-xl p-3 mt-3 ${
            resultado === "ok" ? "bg-emerald-50 dark:bg-emerald-900/20" : "bg-amber-50 dark:bg-amber-900/20"
          }`}
        >
          <Text
            className={`text-[11px] font-bold ${
              resultado === "ok" ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"
            }`}
          >
            {t(`autoCapture.pasos.res.${resultado}`)}
          </Text>
          <Text className="text-[11px] leading-4 text-slate-600 dark:text-slate-300 mt-1">
            {t(`autoCapture.pasos.haz.${resultado}`)}
          </Text>
        </View>
      )}

      {/* LOS TRES AJUSTES. Se enseñan siempre y no solo cuando la prueba falla: si la
          prueba suena pero el yapeo de la noche no despertó al celular, el que falta es el
          del ahorro de batería, y esa prueba sale "ok". */}
      <View className="mt-3.5 gap-2">
        <BotonDePaso
          texto={t("autoCapture.pasos.voz")}
          onPress={() => abrir(notificationReader.abrirAjustesDeVoz)}
        />
        <BotonDePaso
          texto={t("autoCapture.pasos.volumen")}
          onPress={() => abrir(notificationReader.abrirAjustesDeSonido)}
        />
        <BotonDePaso
          texto={t("autoCapture.pasos.bateria")}
          onPress={() => abrir(notificationReader.abrirAjustesDeBateria)}
        />
      </View>

      {noSeAbrio && (
        <Text className="text-[11px] leading-4 text-amber-700 dark:text-amber-300 mt-3">
          {t("autoCapture.pasos.noSeAbrio")}
        </Text>
      )}
    </View>
  );
}

/** Un paso: qué hacer, y la flecha que lleva al ajuste de Android que lo arregla. */
function BotonDePaso({ texto, onPress }: { texto: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row items-center justify-between py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800"
    >
      <Text className="text-[11px] font-bold text-slate-600 dark:text-slate-200 flex-1 pr-2">
        {texto}
      </Text>
      <ChevronRight size={14} color="#94a3b8" />
    </TouchableOpacity>
  );
}
