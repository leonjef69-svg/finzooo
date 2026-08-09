import { useEffect, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View,
  Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Zap, ShieldCheck, Check, ChevronRight, Trash2, Smartphone, Activity, RotateCcw, Volume2, Store } from "lucide-react-native";
import { router } from "expo-router";
import * as notificationReader from "@/modules/notification-reader";
import { useColorScheme } from "nativewind";
import BackButton from "@/components/BackButton";
import Toggle from "@/components/Toggle";
import { useAppData } from "@/contexts/AppDataContext";
import { CARD_SHADOW } from "@/constants/style";
import type { CaptureLogEntry } from "@/utils/autoCapture";
import { horaDe } from "@/utils/format";

// Color con el que se pinta cada resultado en el diagnóstico. Verde = se
// registró; ámbar = se reconoció pero no hacía falta; gris = no era un
// movimiento.
const RESULT_COLOR: Record<CaptureLogEntry["result"], string> = {
  added: "#059669",
  duplicate: "#f59e0b",
  noAmount: "#94a3b8",
  noDirection: "#94a3b8",
  notMoney: "#94a3b8",
};

function fmtTime(ms: number): string {
  const d = new Date(ms);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month} ${hh}:${mm}`;
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
  // viven: el servicio los consulta aunque Finzo este cerrada.
  const [hablar, setHablar] = useState(() => notificationReader.isSpeakEnabled());
  const [hablarSalidas, setHablarSalidas] = useState(() => notificationReader.isSpeakOutgoing());
  // El diagnóstico viene cerrado: sirve cuando algo falla, no cada día.
  const [verDetalles, setVerDetalles] = useState(false);
  useEffect(() => {
    if (!autoCaptureSupported) return;
    const timer = setInterval(() => setStats(notificationReader.stats()), 3000);
    return () => clearInterval(timer);
  }, [autoCaptureSupported]);

  // Las más recientes arriba.
  const log = [...autoCaptureLog].reverse();

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
        <View className="flex-row items-start gap-3 mb-5">
          <View className="w-10 h-10 rounded-2xl bg-violet-50 dark:bg-slate-800 items-center justify-center">
            <Zap size={18} color="#8b5cf6" />
          </View>
          <Text className="flex-1 text-xs leading-5 text-slate-500 dark:text-slate-300">
            {t("autoCapture.subtitle")}
          </Text>
        </View>

        {/* Aviso de privacidad. Va ANTES de pedir nada, y no en letra chica:
            el permiso que Android exige da acceso a todas las notificaciones,
            así que la persona merece saber exactamente qué se hace con ellas
            antes de decidir. */}
        <View
          className="rounded-2xl p-4 mb-5 bg-emerald-50 dark:bg-slate-800 border-[1.5px] border-emerald-100 dark:border-slate-700"
          style={CARD_SHADOW}
        >
          <View className="flex-row items-center gap-2 mb-2">
            <ShieldCheck size={16} color="#059669" />
            <Text className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
              {t("autoCapture.privacyTitle")}
            </Text>
          </View>
          <Text className="text-[11px] leading-5 text-emerald-800 dark:text-slate-300">
            {t("autoCapture.privacyBody")}
          </Text>
        </View>

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
            {/* Paso 1: el permiso de Android. No se puede pedir con una
                ventanita: hay que mandar a la persona a los ajustes del
                sistema y que lo active ella misma. */}
            {/* Este paso sigue tocándose aunque el permiso ya esté dado.
                Antes se desactivaba al concederlo, y resultó ser justo lo
                que hacía falta después: cuando Android suelta el servicio
                —pasa al instalar una versión nueva encima— el permiso
                sigue marcado como dado, y el arreglo es apagar y prender
                Finzo en esa misma pantalla de Android. Con el botón
                desactivado, la única forma de llegar ahí era buscarla a
                mano en los ajustes del celular. */}
            <TouchableOpacity
              onPress={openAutoCaptureSettings}
              className="w-full flex-row items-center gap-3 bg-white dark:bg-slate-900 rounded-2xl p-4 border-[1.5px] border-slate-200 dark:border-slate-700 mb-2.5"
              style={CARD_SHADOW}
            >
              <View
                className={`w-9 h-9 rounded-xl items-center justify-center ${
                  autoCapturePermission ? "bg-emerald-50 dark:bg-emerald-950" : "bg-slate-50 dark:bg-slate-800"
                }`}
              >
                {autoCapturePermission ? (
                  <Check size={16} color="#059669" />
                ) : (
                  <Text className="text-xs font-extrabold text-slate-500">1</Text>
                )}
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {t("autoCapture.permissionTitle")}
                </Text>
                <Text className="text-[11px] text-slate-500 dark:text-slate-300 mt-0.5">
                  {t(autoCapturePermission ? "autoCapture.permissionGranted" : "autoCapture.permissionHint")}
                </Text>
              </View>
              <ChevronRight size={16} color="#cbd5e1" />
            </TouchableOpacity>

            {/* Paso 2: el interruptor de Finzo. Sigue disponible aunque el
                permiso esté dado, para poder parar la captura sin tener que
                ir a los ajustes de Android. */}
            <View
              className="w-full flex-row items-center gap-3 bg-white dark:bg-slate-900 rounded-2xl p-4 border-[1.5px] border-slate-200 dark:border-slate-700"
              style={CARD_SHADOW}
            >
              <View className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-800 items-center justify-center">
                <Text className="text-xs font-extrabold text-slate-500">2</Text>
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {t("autoCapture.toggleTitle")}
                </Text>
                <Text className="text-[11px] text-slate-500 dark:text-slate-300 mt-0.5">
                  {t(autoCapturePermission ? "autoCapture.toggleHint" : "autoCapture.toggleBlocked")}
                </Text>
              </View>
              {autoCapturePermission && <Toggle on={autoCaptureOn} onChange={setAutoCaptureOn} />}
            </View>

            {/* Estado del servicio de Android.
                Cuando no se captura nada hay tres causas posibles y desde
                fuera se ven idénticas: una pantalla vacía. Estas dos líneas
                las separan. "Avisos vistos" cuenta TODAS las notificaciones
                del celular, de cualquier app, antes de filtrar nada — solo
                el número, nunca el contenido. */}
            <View
              className="rounded-2xl p-4 mt-6 bg-white dark:bg-slate-900 border-[1.5px] border-slate-200 dark:border-slate-700"
              style={CARD_SHADOW}
            >
              <View className="flex-row items-center gap-2 mb-3">
                <Activity size={15} color={iconColor} />
                <Text className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  {t("autoCapture.statusTitle")}
                </Text>
              </View>

              <View className="flex-row items-center justify-between mb-1.5">
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

              {/* EL RESTO, DETRÁS DE UN TOQUE.
                  El contador de avisos, el nombre del paquete y el motivo de
                  la voz son para cuando algo falla, no para el uso diario:
                  ocupaban media pantalla todos los días para servir un rato
                  cada mes. Siguen ahí, a un toque. */}
              <TouchableOpacity
                onPress={() => setVerDetalles((v) => !v)}
                className="mt-2.5 py-1"
              >
                <Text className="text-[11px] font-bold text-slate-400 dark:text-slate-500">
                  {t(verDetalles ? "autoCapture.statusHide" : "autoCapture.statusDetails")}
                </Text>
              </TouchableOpacity>

              {verDetalles && (
                <View className="mt-2 pt-3 border-t-[1.5px] border-slate-100 dark:border-slate-700">
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

                  {/* POR QUÉ HABLÓ O SE CALLÓ. Vive aquí y no junto al
                      interruptor: es diagnóstico, igual que lo de arriba. */}
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
              )}

              {!stats.connected && (
                <TouchableOpacity
                  onPress={() => {
                    notificationReader.requestRebind();
                    setStats(notificationReader.stats());
                  }}
                  className="flex-row items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 mt-3"
                >
                  <RotateCcw size={13} color="#64748b" />
                  <Text className="text-[11px] font-bold text-slate-600 dark:text-slate-200">
                    {t("autoCapture.statusRetry")}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* DECIRLO EN VOZ ALTA.
                Solo si el APK lo trae: es código nativo y no llega por
                actualización. Enseñar un interruptor que no hace nada sería
                peor que no enseñarlo. */}
            {notificationReader.canSpeak && (
              <View className="rounded-2xl border-[1.5px] border-slate-200 dark:border-slate-700 p-4 mt-6">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 pr-3">
                    <Text className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      {t("autoCapture.speakTitle")}
                    </Text>
                    <Text className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mt-1">
                      {t("autoCapture.speakHint")}
                    </Text>
                  </View>
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
                  <View className="flex-row items-center justify-between mt-3.5 pt-3.5 border-t-[1.5px] border-slate-100 dark:border-slate-700">
                    <View className="flex-1 pr-3">
                      <Text className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        {t("autoCapture.speakOutTitle")}
                      </Text>
                      <Text className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mt-1">
                        {t("autoCapture.speakOutHint")}
                      </Text>
                    </View>
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

              </View>
            )}

            {/* SI NO SE ESCUCHA: LOS PASOS, CON SUS BOTONES.
                Pedido el 07/08/2026: *"no se escucha en voz alta, capaz pueda
                ser mi celular, necesito que incorpores en registro automático
                los pasos que se deben seguir para una correcta funcionamiento
                para cualquier celular"*, y luego: *"como botones que te manden
                a una pestaña y te diga que tengas que hacer"*.
                Va aquí, pegado a los interruptores de la voz, y no en una
                pantalla de ayuda aparte: quien no oye la voz está mirando
                justo estos interruptores. */}
            {notificationReader.canSpeak && hablar && <PasosDeLaVoz />}

            {/* Diagnóstico. Sirve para dos cosas: que se vea que la app no
                está guardando nada raro, y que se pueda saber por qué un
                Yape no se registró (los bancos cambian sus textos). */}
            <View className="flex-row items-center justify-between mt-6 mb-2.5 px-1">
              <Text className="text-xs font-bold text-slate-500 dark:text-slate-300">
                {t("autoCapture.logTitle")}
              </Text>
              {log.length > 0 && (
                <TouchableOpacity onPress={clearAutoCaptureLog} className="flex-row items-center gap-1.5">
                  <Trash2 size={13} color="#94a3b8" />
                  <Text className="text-[11px] font-bold text-slate-400">{t("autoCapture.logClear")}</Text>
                </TouchableOpacity>
              )}
            </View>

            {log.length === 0 ? (
              <View
                className="rounded-2xl p-4 bg-white dark:bg-slate-900 border-[1.5px] border-slate-200 dark:border-slate-700"
                style={CARD_SHADOW}
              >
                <Text className="text-[11px] leading-5 text-slate-500 dark:text-slate-300">
                  {t("autoCapture.logEmpty")}
                </Text>
              </View>
            ) : (
              <View className="gap-2">
                {log.map((entry, i) => (
                  <View
                    key={`${entry.at}-${i}`}
                    className="rounded-2xl p-3.5 bg-white dark:bg-slate-900 border-[1.5px] border-slate-200 dark:border-slate-700"
                    style={CARD_SHADOW}
                  >
                    <View className="flex-row items-center justify-between mb-1">
                      <Text
                        className="text-[11px] font-bold"
                        style={{ color: RESULT_COLOR[entry.result] }}
                      >
                        {t(`autoCapture.result.${entry.result}`)}
                        {entry.amount != null ? ` · ${fmt(entry.amount)}` : ""}
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
