import { useEffect, useRef } from "react";
import { Animated, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { Delete, Fingerprint, ScanFace } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { PIN_LENGTH } from "@/utils/appLock";
import type { BiometricKind } from "@/utils/appLock";

/**
 * Teclado numérico para el PIN.
 *
 * Es un teclado propio y no el del sistema a propósito: el del sistema tapa
 * media pantalla, tarda en aparecer y en un celular con el teclado en otro
 * idioma puede ni mostrar números. Aquí las teclas siempre están donde se
 * espera y no hay nada que cargar.
 */
// La separacion entre teclas, igual en horizontal y en vertical.
const GAP = 12;

export default function PinPad({
  value,
  onChange,
  error,
  biometric,
  onBiometric,
}: {
  value: string;
  onChange: (next: string) => void;
  /** Cuando es true, los puntitos tiemblan y se ponen rojos. */
  error?: boolean;
  /** Si hay huella disponible, se ofrece como tecla extra abajo a la izquierda. */
  biometric?: BiometricKind;
  onBiometric?: () => void;
}) {
  const { width: screenWidth } = useWindowDimensions();
  // Se mide la pantalla y se reparte a mano: el ancho del teclado, y el de
  // cada tecla descontando las dos separaciones. Todo en numeros, para que
  // ninguna tecla pueda quedarse en cero por lo que decida el contenedor.
  const padWidth = Math.min(300, Math.max(210, screenWidth - 80));
  const keyWidth = (padWidth - GAP * 2) / 3;

  const shake = useRef(new Animated.Value(0)).current;

  // El temblor al equivocarse no es adorno: es la forma más rápida de
  // entender que el PIN estuvo mal sin tener que leer nada.
  useEffect(() => {
    if (!error) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [error, shake]);

  function press(digit: string) {
    if (value.length >= PIN_LENGTH) return;
    Haptics.selectionAsync().catch(() => {});
    onChange(value + digit);
  }

  function backspace() {
    if (value.length === 0) return;
    Haptics.selectionAsync().catch(() => {});
    onChange(value.slice(0, -1));
  }

  const showBiometric = biometric && biometric !== "none" && onBiometric;

  return (
    <View className="items-center">
      {/* Los puntitos: cuántas cifras se llevan */}
      <Animated.View
        className="flex-row gap-4 mb-10"
        style={{ transform: [{ translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-10, 10] }) }] }}
      >
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <View
            key={i}
            className={`w-3.5 h-3.5 rounded-full ${
              error
                ? "bg-rose-500"
                : i < value.length
                  ? "bg-emerald-600"
                  : "bg-slate-200 dark:bg-slate-700"
            }`}
          />
        ))}
      </Animated.View>

      {/* EL ANCHO SE CALCULA, NO SE HEREDA.

          Tres intentos y este es el bueno, así que conviene dejar escrito por
          qué:

          1. Ancho fijo de 76 con justify-between. Si el contenedor daba justo
             para las tres (3 × 76 = 228), no sobraba nada que repartir y las
             teclas salían pegadas. Ese fue el primer fallo.

          2. flex-1 con gap. PEOR: dejó el teclado SIN NÚMEROS. Este bloque
             vive dentro de un contenedor con items-center, y ahí un hijo se
             encoge a su contenido salvo que tenga ancho propio. El "w-full"
             era un 100% de un padre sin ancho definido, así que las teclas
             con flex-1 se quedaron en cero y solo se veían los dos iconos,
             que sí traen tamaño de fábrica. Con el bloqueo puesto, eso deja
             a alguien mirando una pantalla sin teclado.

          3. Esto: se mide la pantalla y se reparte a mano. No hay porcentajes
             ni flex que dependan de lo que decida el padre, así que no puede
             volver a colapsar. */}
      <View style={{ width: padWidth }}>
        {[
          ["1", "2", "3"],
          ["4", "5", "6"],
          ["7", "8", "9"],
        ].map((row) => (
          <View key={row[0]} className="flex-row mb-3" style={{ gap: GAP }}>
            {row.map((digit) => (
              <Key key={digit} width={keyWidth} onPress={() => press(digit)}>
                <Text className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{digit}</Text>
              </Key>
            ))}
          </View>
        ))}

        <View className="flex-row" style={{ gap: GAP }}>
          {showBiometric ? (
            <Key onPress={onBiometric} plain width={keyWidth}>
              {biometric === "face" ? (
                <ScanFace size={26} color="#059669" />
              ) : (
                <Fingerprint size={26} color="#059669" />
              )}
            </Key>
          ) : (
            // Hueco vacío para que el "0" siga en el centro.
            <View style={{ width: keyWidth, height: 64 }} />
          )}

          <Key onPress={() => press("0")} width={keyWidth}>
            <Text className="text-2xl font-semibold text-slate-900 dark:text-slate-100">0</Text>
          </Key>

          <Key onPress={backspace} plain width={keyWidth}>
            <Delete size={24} color="#94a3b8" />
          </Key>
        </View>
      </View>
    </View>
  );
}

function Key({
  onPress,
  children,
  plain,
  width,
}: {
  onPress: () => void;
  children: React.ReactNode;
  plain?: boolean;
  /** Ancho ya calculado. Obligatorio: sin él la tecla se queda en cero. */
  width: number;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.6}
      // El ancho llega como número, no como flex-1. Con flex-1 dentro de un
      // contenedor sin ancho definido las teclas se quedaron en cero y el
      // teclado apareció sin números. En la pantalla más estrecha que se
      // contempla, cada tecla mide 62: por encima de los 48 que Android pide
      // como mínimo para poder tocar algo sin fallar.
      style={{ width, height: 64 }}
      className={`items-center justify-center rounded-2xl ${
        plain ? "" : "bg-slate-100 dark:bg-slate-800"
      }`}
    >
      {children}
    </TouchableOpacity>
  );
}
