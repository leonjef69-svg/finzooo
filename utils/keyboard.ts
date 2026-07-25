import { useEffect, useState } from "react";
import { Keyboard, Platform, useWindowDimensions } from "react-native";

// Cuánto espacio le quita REALMENTE el teclado a la pantalla.
//
// El problema que resuelve
// ------------------------
// Un panel inferior se dibuja pegado al borde de abajo. Si no sabe que hay
// un teclado abierto pasan dos cosas a la vez:
//
//   · Lo de abajo (Descripción, Notas, Cancelar/Guardar) queda TAPADO.
//   · Como el panel sigue midiendo la pantalla entera pero solo cabe la
//     mitad, lo que sobra se sale POR ARRIBA.
//
// Por qué NO se calcula restando alturas
// --------------------------------------
// El intento anterior guardaba el alto de la pantalla sin teclado para
// compararlo después. No funcionaba: al abrirse el teclado, ese alto y el
// aviso del teclado cambian en el mismo instante, y React puede procesarlos
// en cualquier orden. Cuando llegaban al revés se guardaba el alto YA
// encogido como si fuera el completo, salía "el teclado tapa 0 píxeles" y
// el panel se quedaba otra vez debajo del teclado.
//
// Cómo se calcula ahora
// ---------------------
// Se pregunta la posición absoluta donde EMPIEZA el teclado (screenY). Es
// una coordenada fija de la pantalla: no depende del orden de los avisos ni
// de si Android encogió la ventana o no, así que sirve en los dos casos:
//
//   · Ventana sin encoger: alto 2400, teclado empieza en 1400 → tapa 1000.
//   · Ventana encogida:    alto 1400, teclado empieza en 1400 → tapa 0,
//     porque Android ya lo descontó y volver a restarlo sería contarlo dos
//     veces (el otro error que tuvo esta pantalla).
export function useKeyboardOverlap() {
  const { height: windowHeight } = useWindowDimensions();

  // Dónde empieza el teclado. null = teclado cerrado.
  const [keyboardTop, setKeyboardTop] = useState<number | null>(null);

  useEffect(() => {
    // En iOS conviene reaccionar antes de que termine la animación (will…);
    // en Android el aviso fiable llega cuando ya subió (did…).
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (e) => {
      const coords = e.endCoordinates;
      if (!coords) return;
      // screenY es donde empieza el teclado. Si el celular no lo reporta,
      // se deduce con la altura, que es el dato que sí llega siempre.
      const top =
        typeof coords.screenY === "number" ? coords.screenY : windowHeight - coords.height;
      setKeyboardTop(top);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardTop(null));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [windowHeight]);

  const overlap = keyboardTop === null ? 0 : Math.max(0, windowHeight - keyboardTop);

  return {
    /** Alto de la ventana ahora mismo. */
    windowHeight,
    /** Píxeles que hay que dejar libres abajo para no quedar bajo el teclado. */
    overlap,
    /** Si hay teclado abierto (para ajustar márgenes). */
    keyboardVisible: keyboardTop !== null,
  };
}
