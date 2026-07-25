import { useEffect, useState } from "react";
import { Keyboard } from "react-native";
import { useAnimatedKeyboard, useAnimatedStyle } from "react-native-reanimated";

// Cuánto hay que levantar un panel inferior para que el teclado no lo tape.
//
// Historial de intentos fallidos con el módulo Keyboard de React Native
// ----------------------------------------------------------------------
// Los primeros seis intentos (documentados en el historial de git de este
// archivo) usaban `Keyboard.addListener` + `Keyboard.metrics()`: eventos de
// JavaScript que Android dispara cuando el teclado se abre o se cierra.
//
// El fallo de fondo, confirmado con captura de pantalla real: al saltar de
// un campo a otro SIN que el teclado se cierre (Notas → Monto, por
// ejemplo), Android no siempre dispara ESE aviso, o lo dispara con datos
// todavía viejos. El resultado eran botones que desaparecían del todo
// (padding aplicado: 0, como si no hubiera teclado) o un hueco enorme
// (padding aplicado: el del teclado anterior, más alto).
//
// La solución: dejar de escuchar eventos de JavaScript por completo.
// `useAnimatedKeyboard` (de Reanimated, ya instalado en este proyecto) no
// depende de esos avisos — engancha directamente la animación nativa del
// teclado y actualiza su valor cuadro a cuadro, sea cual sea el motivo por
// el que el teclado cambia de tamaño. No hay aviso que perderse porque no
// hay aviso: es el propio sistema operativo empujando el valor.
export function useKeyboardAnimatedPadding() {
  const keyboard = useAnimatedKeyboard();

  const animatedPaddingStyle = useAnimatedStyle(() => ({
    paddingBottom: keyboard.height.value,
  }));

  // Esto SÍ puede seguir basado en eventos de JS: solo decide un detalle
  // cosmético (16 vs 32+insets.bottom de margen), no la posición real de
  // los botones — no hace falta que esté sincronizado al cuadro exacto.
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return { animatedPaddingStyle, keyboardVisible };
}
