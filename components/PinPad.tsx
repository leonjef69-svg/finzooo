import { useEffect, useRef } from "react";
import { Animated, Text, TouchableOpacity, View } from "react-native";
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

      <View className="w-full max-w-[280px]">
        {[
          ["1", "2", "3"],
          ["4", "5", "6"],
          ["7", "8", "9"],
        ].map((row) => (
          <View key={row[0]} className="flex-row justify-between mb-3">
            {row.map((digit) => (
              <Key key={digit} onPress={() => press(digit)}>
                <Text className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{digit}</Text>
              </Key>
            ))}
          </View>
        ))}

        <View className="flex-row justify-between">
          {showBiometric ? (
            <Key onPress={onBiometric} plain>
              {biometric === "face" ? (
                <ScanFace size={26} color="#059669" />
              ) : (
                <Fingerprint size={26} color="#059669" />
              )}
            </Key>
          ) : (
            // Hueco vacío para que el "0" siga en el centro.
            <View style={{ width: 76, height: 64 }} />
          )}

          <Key onPress={() => press("0")}>
            <Text className="text-2xl font-semibold text-slate-900 dark:text-slate-100">0</Text>
          </Key>

          <Key onPress={backspace} plain>
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
}: {
  onPress: () => void;
  children: React.ReactNode;
  plain?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.6}
      // Teclas grandes: 76×64 es cómodo con el pulgar y con una mano.
      style={{ width: 76, height: 64 }}
      className={`items-center justify-center rounded-2xl ${
        plain ? "" : "bg-slate-100 dark:bg-slate-800"
      }`}
    >
      {children}
    </TouchableOpacity>
  );
}
