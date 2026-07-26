import { useEffect, useState } from "react";
import { Keyboard } from "react-native";
import { KeyboardState, useAnimatedKeyboard, useAnimatedStyle } from "react-native-reanimated";

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
//
// Un segundo bug, encontrado después con medición real (captura de
// pantalla con estado y altura en vivo): al cerrar esta pantalla (Guardar
// o Cancelar) sin decirle explícitamente al teclado que se cierre, el
// sistema podía quedarse creyendo "sigue abierto". La SIGUIENTE vez que
// se abría una hoja nueva, heredaba ese estado viejo — llegó a verse
// estado=OPEN con altura=341 sin ningún teclado real en pantalla, lo que
// dejaba un hueco vacío del tamaño exacto de un teclado.
//
// Esto tiene dos capas de corrección:
//   1. Cada pantalla que use este hook debe cerrar el teclado a propósito
//      al desmontarse (Keyboard.dismiss() en el cleanup de un useEffect),
//      para que la siguiente instancia arranque de un estado realmente
//      cerrado. Ver AddSheet.tsx, GoalFormSheet.tsx, MoveMoneySheet.tsx.
//   2. Como red de seguridad, aquí también se ignora la altura cuando el
//      estado dice explícitamente CLOSED — por si el aviso de cierre
//      tardara en llegar.
export function useKeyboardAnimatedPadding() {
  const keyboard = useAnimatedKeyboard();

  const animatedPaddingStyle = useAnimatedStyle(() => ({
    paddingBottom: keyboard.state.value === KeyboardState.CLOSED ? 0 : keyboard.height.value,
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
