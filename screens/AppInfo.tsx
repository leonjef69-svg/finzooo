import { useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Sparkles, Wallet, RefreshCw } from "lucide-react-native";
import * as Updates from "expo-updates";
import { LEGAL_CONTACT_EMAIL } from "@/constants/legal";
import { useAppData } from "@/contexts/AppDataContext";
import BackButton from "@/components/BackButton";
import Toggle from "@/components/Toggle";
import * as incomingFile from "@/modules/incoming-file";
import * as shareToApp from "@/modules/share-to-app";
import * as textRecognizer from "@/modules/text-recognizer";
import * as notificationReader from "@/modules/notification-reader";
import { puedeExportarEnFondo, puedePdfEnFondo } from "@/modules/export-scheduler";

const APP_VERSION = "1.0.0";

/**
 * Marca de la versión del CÓDIGO, no de la app.
 *
 * Se sube a mano en cada entrega. Existe porque durante un día entero no hubo
 * forma de saber si los arreglos publicados estaban llegando al celular o no:
 * se reportaba un fallo, se arreglaba, se publicaba, y volvía a reportarse el
 * mismo fallo. Sin saber qué código se estaba ejecutando, cada arreglo era a
 * ciegas — y podía estar ya hecho.
 *
 * La versión de la app (1.0.0) no sirve para esto: no cambia entre entregas.
 * Esta sí.
 */
const CODE_MARKER = "12ago-17";

export default function AppInfo({ onBack }: { onBack: () => void }) {
  const { t, showToast, verComoGratis, setVerComoGratis, tienePremiumDeVerdad } = useAppData();
  const insets = useSafeAreaInsets();
  const [checking, setChecking] = useState(false);
  /** Toques en la marca del código. A los siete aparece el interruptor de "ver como gratis". */
  const [toques, setToques] = useState(0);
  // Se enseña a quien tiene Premium de verdad, o a quien ya lo tiene puesto —o no habría forma
  // de quitárselo—. A alguien sin Premium no le sirve de nada: ya ve la app así.
  const modoPruebaVisible = toques >= 7 && (tienePremiumDeVerdad || verComoGratis);
  // El motivo exacto del ultimo fallo al actualizar. Se deja escrito en
  // pantalla porque un mensajito que se va solo no sirve para copiarlo.
  const [updateError, setUpdateError] = useState("");

  /**
   * Busca una actualización AHORA y la aplica.
   *
   * Normalmente esto pasa solo: la app la descarga al abrirse y la aplica
   * en el siguiente arranque. Pero eso obliga a cerrar y abrir dos veces, y
   * cuando algo está roto no hay forma de saber si ya llegó el arreglo o
   * todavía se está usando la versión con el fallo. Este botón quita esa
   * duda: se toca y, si hay algo nuevo, la app se reinicia con ello.
   */
  async function checkForUpdate() {
    if (checking) return;
    setChecking(true);
    setUpdateError("");
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        showToast(t("appInfo.updateNone"));
        return;
      }
      showToast(t("appInfo.updateDownloading"));
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch (e) {
      // Se guarda el motivo EXACTO y se deja escrito en pantalla, no en un
      // mensajito que se va solo.
      //
      // Antes solo salía "no se pudo actualizar". Con eso no hay forma de
      // distinguir un celular sin internet de un canal mal configurado o de
      // una versión que no corresponde, y se pierden días adivinando cuál de
      // las tres es. El texto no es bonito, pero es el único que dice la
      // verdad de lo que pasó.
      const motivo = e instanceof Error ? e.message : String(e);
      setUpdateError(motivo);
      showToast(t("appInfo.updateError"));
    } finally {
      setChecking(false);
    }
  }

  // Qué código se está ejecutando ahora mismo. "Embebida" significa que es
  // la que venía dentro del APK; si no, es una actualización recibida por
  // aire. Sin esto no había forma de saber si un arreglo ya había llegado.
  const runningLabel = Updates.isEmbeddedLaunch
    ? t("appInfo.updateEmbedded")
    : `${(Updates.updateId ?? "").slice(0, 8)} · ${
        Updates.createdAt ? new Date(Updates.createdAt).toLocaleString() : "—"
      }`;
  const WHATS_NEW = [
    t("appInfo.whatsNewItem1"),
    t("appInfo.whatsNewItem2"),
    t("appInfo.whatsNewItem3"),
  ];
  return (
    <View className="flex-1 bg-white dark:bg-slate-900" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View className="flex-row items-center justify-between px-5 pt-2 pb-4">
        <BackButton onPress={onBack} />
        <Text className="text-base font-bold text-slate-900 dark:text-slate-100">{t("appInfo.title")}</Text>
        <View className="w-10" />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="items-center pt-4 pb-6">
          <View className="w-16 h-16 rounded-2xl bg-emerald-600 items-center justify-center mb-4">
            <Wallet size={28} color="#ffffff" strokeWidth={2.2} />
          </View>
          <Text className="text-xl font-extrabold text-slate-900 dark:text-slate-100">Fino</Text>
          <Text className="text-xs text-slate-500 dark:text-slate-300 mt-1">
            {t("appInfo.version", { version: APP_VERSION })}
          </Text>
          {/* Estas dos líneas son para poder decir por chat, sin adivinar,
              qué está corriendo el celular: la marca del código y de dónde
              vino. Ver CODE_MARKER. */}
          {/* SIETE TOQUES AQUÍ SACAN EL INTERRUPTOR DE "VER COMO GRATIS".
              Escondido porque a nadie le hace falta y sale en medio de una pantalla que se abre
              para comprobar la versión, no para tocar ajustes.
              Y ESCONDIDO NO ES UN CANDADO, así que el interruptor tiene que ser inofensivo por
              sí mismo: solo QUITA Premium, no lo da. Ver verComoGratis en el contexto. */}
          <TouchableOpacity activeOpacity={1} onPress={() => setToques((n) => n + 1)}>
            <Text className="text-xs font-bold text-slate-500 dark:text-slate-300 mt-1.5" selectable>
              {t("appInfo.codeMarker", { marker: CODE_MARKER })}
            </Text>
          </TouchableOpacity>
          <Text className="text-[10px] text-slate-400 mt-0.5" selectable>
            {runningLabel}
          </Text>

          {/* EL INTERRUPTOR DE PRUEBA. Ver los siete toques, arriba. */}
          {modoPruebaVisible && (
            <View className="mt-4 mx-5 rounded-2xl border-[1.5px] border-amber-400 bg-amber-50 dark:bg-slate-800 p-4 w-full">
              <View className="flex-row items-center gap-3">
                <View className="flex-1">
                  <Text className="text-xs font-bold text-amber-700 dark:text-amber-400">
                    {t("appInfo.verComoGratis")}
                  </Text>
                  <Text className="text-[11px] leading-5 text-slate-600 dark:text-slate-300 mt-1">
                    {t("appInfo.verComoGratisTexto")}
                  </Text>
                </View>
                <Toggle on={verComoGratis} onChange={setVerComoGratis} />
              </View>
            </View>
          )}

          {/* QUÉ PARTES NATIVAS TRAE ESTE APK.
              Las actualizaciones por internet solo cambian el JavaScript;
              esto viene dentro del APK y solo cambia reinstalando. Sin verlo
              no hay forma de saber si un arreglo nativo está o no, y se
              acaba arreglando dos veces algo que ya estaba bien. */}
          <Text className="text-[10px] text-slate-400 mt-1" selectable>
            {t("appInfo.nativeParts")}: {incomingFile.isSupported ? "✓" : "✗"} compartir ·{" "}
            {/* Ponía "gmail", y es el mismo módulo que abre el chat de
                WhatsApp con el número puesto. Viéndolo así parecía que lo de
                WhatsApp no venía en el APK. */}
            {shareToApp.isSupported ? "✓" : "✗"} enviar directo ·{" "}
            {/* Esta distingue el APK del 1 de agosto de los anteriores. Los
                de antes también traen "enviar directo", así que esa línea
                sola no dice cuál está instalado, y quien no recuerde si
                llegó a instalarlo se queda sin saberlo. */}
            {shareToApp.hasDirectMail ? "✓" : "✗"} correo directo ·{" "}
            {textRecognizer.isSupported ? "✓" : "✗"} escáner ·{" "}
            {/* El APK del 2 de agosto por la mañana ya traía la voz, pero se
                quedaba muda con un yapeo de verdad. Esta línea distingue uno
                del otro: sin ella, el arreglo ya instalado parece no estar. */}
            {notificationReader.hasSpeakReason ? "✓" : "✗"} voz afinada ·{" "}
            {/* Y esta distingue el APK que habla SIN ESPERA de los anteriores,
                que ya traían la voz pero tardaban unos segundos. Sin ella,
                "sigue tardando" no dice si el arreglo llegó a instalarse. */}
            {notificationReader.hasVozSinEspera ? "✓" : "✗"} voz al instante ·{" "}
            {/* LAS DOS DE LA EXPORTACIÓN AUTOMÁTICA, y hacían falta.
                El 06/08/2026 el usuario reportó que el PDF no salía solo. El
                motivo era que su APK trae el despertador pero NO el conversor de
                PDF —llegó en uno posterior que no había instalado—, y no había
                forma de verlo: la marca del código dice la del JavaScript, que
                sí le había llegado por internet. Con estas dos, una captura
                contesta la pregunta.
                Son dos y no una a propósito: el despertador llegó antes que el
                conversor, así que hay APK con el primero y sin el segundo. Es
                justo el caso que costó este ida y vuelta. */}
            {puedeExportarEnFondo() ? "✓" : "✗"} reporte solo ·{" "}
            {puedePdfEnFondo() ? "✓" : "✗"} PDF solo
          </Text>

          <TouchableOpacity
            onPress={checkForUpdate}
            disabled={checking}
            className="flex-row items-center gap-2 mt-4 px-4 py-2.5 rounded-full bg-slate-100 dark:bg-slate-800"
          >
            <RefreshCw size={14} color="#64748b" />
            <Text className="text-xs font-bold text-slate-600 dark:text-slate-200">
              {t(checking ? "appInfo.updateChecking" : "appInfo.updateCheck")}
            </Text>
          </TouchableOpacity>

          {/* El motivo exacto del fallo, escrito y sin irse solo. Es feo a
              propósito: no está para leerlo por gusto, sino para poder
              copiarlo tal cual cuando algo no llega. */}
          {updateError !== "" && (
            <View className="mt-3 mx-6 rounded-xl border-[1.5px] border-rose-300 bg-rose-50 dark:bg-rose-900/20 px-3 py-2.5">
              <Text className="text-[11px] font-bold text-rose-600 dark:text-rose-300">
                {t("appInfo.updateErrorTitle")}
              </Text>
              <Text className="text-[10px] text-rose-700 dark:text-rose-200 mt-1" selectable>
                {updateError}
              </Text>
            </View>
          )}
        </View>

        <View className="px-6">
          <Text className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed text-center">
            {t("appInfo.description")}
          </Text>
          <Text className="text-xs text-slate-500 dark:text-slate-300 text-center mt-6">
            {t("appInfo.questions", { email: LEGAL_CONTACT_EMAIL })}
          </Text>
        </View>

        <View className="h-px bg-slate-100 dark:bg-slate-800 mx-6 mt-8 mb-6" />

        <View className="px-6">
          <View className="flex-row items-center gap-2 mb-3">
            <Sparkles size={16} color="#059669" />
            <Text className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
              {t("appInfo.whatsNew", { version: APP_VERSION })}
            </Text>
          </View>
          <View className="gap-2">
            {WHATS_NEW.map((item, i) => (
              <View key={i} className="flex-row gap-2 pl-1">
                <Text className="text-emerald-600">•</Text>
                <Text className="text-sm text-slate-600 dark:text-slate-300 flex-1 leading-relaxed">{item}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
