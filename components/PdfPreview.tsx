import { useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { X } from "lucide-react-native";

/**
 * Enseña el documento tal como va a salir, antes de exportarlo.
 *
 * POR QUÉ SE DIBUJA EL HTML Y NO EL PDF
 *
 * Lo evidente sería generar el PDF y enseñarlo. Pero el PDF SE HACE a partir
 * de este mismo HTML: es expo-print quien lo convierte. Así que dibujar el
 * HTML no es una aproximación de lo que saldrá — es literalmente lo mismo,
 * antes de convertirlo.
 *
 * Y evita generar un archivo solo para mirarlo: un PDF que se descarta deja
 * su basura en la carpeta temporal, y en un estado de cuenta largo tarda.
 *
 * Se ve nítido a cualquier zoom porque casi todo son letras y dibujos
 * vectoriales; lo único que es imagen es el logo, y va al cuádruple del
 * tamaño al que se dibuja.
 */
export default function PdfPreview({
  html,
  title,
  onClose,
}: {
  /** El MISMO html que se le va a dar a expo-print. Sin retocar. */
  html: string;
  title: string;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [cargando, setCargando] = useState(true);

  return (
    <View
      className="absolute inset-0 z-50 bg-slate-100 dark:bg-slate-900"
      style={{ paddingTop: insets.top }}
    >
      <View className="flex-row items-center justify-between px-5 py-3">
        <View className="flex-1 pr-3">
          <Text className="text-base font-extrabold text-slate-900 dark:text-slate-100" numberOfLines={1}>
            {title}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onClose}
          className="w-9 h-9 rounded-full bg-white dark:bg-slate-800 items-center justify-center"
        >
          <X size={16} color="#475569" />
        </TouchableOpacity>
      </View>

      <View className="flex-1 bg-white dark:bg-slate-800 mx-3 mb-3 rounded-2xl overflow-hidden">
        <WebView
          source={{ html }}
          onLoadEnd={() => setCargando(false)}
          // La hoja se mide en puntos, no en píxeles de celular. Sin esto,
          // Android la dibuja al ancho de la pantalla y el documento sale
          // gigante: se ve una esquina y hay que arrastrar para leer.
          scalesPageToFit
          // Nada de esto tiene que estar disponible: aquí solo se dibuja un
          // documento propio. Cuanto menos pueda hacer, mejor.
          javaScriptEnabled={false}
          domStorageEnabled={false}
          allowFileAccess={false}
          // Un documento que no puede salir a internet no puede quedarse
          // esperando a nada que no llegue.
          originWhitelist={["about:blank"]}
          style={{ backgroundColor: "#ffffff" }}
        />
        {cargando && (
          <View className="absolute inset-0 items-center justify-center bg-white dark:bg-slate-800">
            <ActivityIndicator size="large" color="#059669" />
          </View>
        )}
      </View>
    </View>
  );
}
