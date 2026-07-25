import { useCallback, useEffect, useState } from "react";
import { Keyboard } from "react-native";

// Cuánto hay que levantar un panel inferior para que el teclado no lo tape.
//
// Historial de intentos fallidos (para que nadie los repita)
// ---------------------------------------------------------
//   1. "Android encoge la ventana solo"  → falso. Medido en un celular
//      real: la ventana dice 911 con teclado y sin teclado.
//   2. "Comparo contra el alto guardado sin teclado" → ese alto y el aviso
//      del teclado cambian a la vez y llegan en cualquier orden.
//   3. "Resto dónde empieza el teclado" → a veces el contenedor YA venía
//      descontado y se restaba dos veces.
//   4. "Entonces no resto nada" → cuando NO venía descontado, el teclado
//      volvía a tapar los botones.
//   5. "Mido en vivo, pero solo al abrirse y cerrarse" → el teclado no se
//      cierra al saltar de un campo a otro, solo cambia de tamaño, y
//      Android no siempre avisa. Quedaba aplicada la medida vieja.
//   6. "Mido dónde termina el panel y dónde empieza el teclado, y resto" →
//      medido en un celular real:
//
//        panel:    x0 y-38 w424 h948
//        teclado:  empieza en 606, alto 342
//        resta:    (−38 + 948) − 606 = 304
//
//      El panel mide 948 de alto — el alto TOTAL de la pantalla. Pero su
//      posición reportada era y=-38, cuando debería ser y=0 (el panel
//      ocupa la pantalla entera, de borde a borde). Ese desfase de 38 lo
//      causa medir la posición del panel con una API (measureInWindow) y
//      la del teclado con otra (Keyboard.metrics()): no siempre hablan
//      del mismo origen de coordenadas. Si y hubiera sido 0, la resta
//      habría dado 948 − 606 = 342 — EXACTAMENTE el alto del teclado.
//
// La conclusión, y por qué ya no hace falta medir el panel
// ----------------------------------------------------------
// Cuando el panel ocupa la pantalla entera (que es el caso de las tres
// pantallas que usan este hook), lo que el teclado tapa de ese panel es,
// por definición, su propia altura. No hace falta saber dónde está el
// panel ni compararlo con nada: alcanza con preguntarle al teclado cuánto
// mide él mismo. Eso quita de en medio el desfase entre sistemas de
// coordenadas que causó los intentos 3, 4 y 6.
export function useKeyboardPadding() {
  const [padding, setPadding] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const sync = useCallback(() => {
    // Estado ACTUAL del teclado, no el que traía un aviso que quizá ya
    // quedó viejo.
    const metrics = Keyboard.metrics();
    const height = metrics && metrics.height > 0 ? metrics.height : 0;
    setPadding(height);
    setKeyboardVisible(height > 0);
  }, []);

  // Vuelve a comprobar varias veces seguidas: el teclado tarda en terminar
  // de aparecer o de cambiar de tamaño, y la primera medida puede pillarlo
  // a medio camino.
  const syncSoon = useCallback(() => {
    sync();
    const t1 = setTimeout(sync, 60);
    const t2 = setTimeout(sync, 180);
    const t3 = setTimeout(sync, 360);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [sync]);

  useEffect(() => {
    const cleanups: (() => void)[] = [];
    const run = () => cleanups.push(syncSoon());

    // Los cuatro avisos posibles. "ChangeFrame" es el que hace falta para
    // el caso de "el teclado solo cambia de tamaño al saltar de un campo
    // de texto a uno numérico" (no se cierra, así que Show/Hide no avisan).
    const subs = [
      Keyboard.addListener("keyboardDidShow", run),
      Keyboard.addListener("keyboardDidHide", run),
      Keyboard.addListener("keyboardDidChangeFrame", run),
      Keyboard.addListener("keyboardWillChangeFrame", run),
    ];

    return () => {
      subs.forEach((s) => s.remove());
      cleanups.forEach((fn) => fn());
    };
  }, [syncSoon]);

  return {
    /** Alto del teclado ahora mismo (0 si está cerrado). */
    padding,
    /** Si hay teclado abierto (para márgenes cosméticos). */
    keyboardVisible,
    /** Llamar desde el onFocus de cada campo de texto. */
    onFieldFocus: syncSoon,
  };
}
