import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, type View } from "react-native";

// Cuánto hay que levantar un panel inferior para que el teclado no lo tape.
//
// Historial de intentos fallidos (para que nadie los repita)
// ---------------------------------------------------------
//   1. "Android encoge la ventana solo"  → falso. Medido en un celular
//      real: la ventana dice 911 con teclado y sin teclado.
//   2. "Comparo contra el alto guardado sin teclado" → ese alto y el aviso
//      del teclado cambian a la vez y llegan en cualquier orden.
//   3. "Resto dónde empieza el teclado" → a veces el contenedor YA venía
//      descontado y se restaba dos veces: panel estrujado, salido por
//      arriba y con hueco gris abajo.
//   4. "Entonces no resto nada" → cuando NO venía descontado, el teclado
//      volvía a tapar los botones.
//   5. "Mido en vivo, pero solo al abrirse y cerrarse el teclado" → el
//      teclado NO se cierra al saltar de un campo a otro: solo cambia de
//      tamaño, y Android no siempre avisa. Se quedaba aplicada la medida
//      del teclado ANTERIOR. Por eso con el numérico sobraba espacio y con
//      el de texto faltaba: son de distinta altura.
//
// Cómo funciona ahora
// -------------------
// Dos decisiones para que no vuelva a desincronizarse:
//
//   · No se hace caso al dato que trae el aviso, que puede ser viejo. Se
//     pregunta el estado ACTUAL del teclado con Keyboard.metrics().
//   · Se vuelve a comprobar ante cualquier señal: se abrió, se cerró,
//     cambió de tamaño, cambió la distribución, o el panel cambió de sitio.
//     Y unos instantes después otra vez, porque el teclado tarda en
//     terminar de acomodarse.
//
// El cálculo en sí es una resta entre dos medidas reales:
//   dónde TERMINA el panel  −  dónde EMPIEZA el teclado
// Si el sistema ya lo descontó, esa resta da cero sola.
export function useKeyboardPadding(containerRef: React.RefObject<View | null>) {
  const [padding, setPadding] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Se guarda el último valor aplicado para no repintar por diferencias
  // de menos de un píxel (evita un bucle medir → pintar → medir).
  const appliedRef = useRef(0);

  const sync = useCallback(() => {
    // Estado ACTUAL del teclado, no el que traía un aviso que quizá ya
    // quedó viejo. Devuelve undefined si no hay teclado.
    const metrics = Keyboard.metrics();
    const keyboardTop = metrics && metrics.height > 0 ? metrics.screenY : null;

    setKeyboardVisible(keyboardTop !== null);

    if (keyboardTop === null) {
      appliedRef.current = 0;
      setPadding(0);
      return;
    }

    const node = containerRef.current;
    if (!node) return;

    node.measureInWindow((_x, y, _w, height) => {
      if (!Number.isFinite(y) || !Number.isFinite(height)) return;
      const covered = Math.max(0, y + height - keyboardTop);
      if (Math.abs(appliedRef.current - covered) < 1) return;
      appliedRef.current = covered;
      setPadding(covered);
    });
  }, [containerRef]);

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

    // Los cuatro avisos posibles. "ChangeFrame" es el que faltaba: es el
    // que llega cuando el teclado solo cambia de tamaño al saltar de un
    // campo de texto a uno numérico.
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
    /** Píxeles que el teclado tapa del panel, comprobados en vivo. */
    padding,
    /** Si hay teclado abierto (para márgenes cosméticos). */
    keyboardVisible,
    /** Llamar desde el onLayout del contenedor. */
    onContainerLayout: sync,
    /** Llamar desde el onFocus de cada campo de texto. */
    onFieldFocus: syncSoon,
  };
}
