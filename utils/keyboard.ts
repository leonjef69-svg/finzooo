import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

// ¿Hay un teclado abierto ahora mismo?
//
// Ojo: esto NO calcula cuánto espacio ocupa el teclado, y es a propósito.
//
// Medido en un celular real (Android con edgeToEdge):
//
//     pantalla 948 · ventana 911 · teclado de 606 a 948
//
// La ventana nunca se encoge — sigue reportando 911 con y sin teclado. Pero
// la pantalla que contiene los paneles inferiores SÍ se encoge sola: de eso
// se encarga react-native-screens. Es decir, el espacio libre por encima del
// teclado ya viene descontado.
//
// Los intentos anteriores restaban el teclado por su cuenta y lo descontaban
// DOS VECES: el panel quedaba estrujado ~210 px de más, se salía por arriba
// (el campo Monto acababa detrás del reloj) y a la vez dejaba un hueco gris
// sobre el teclado. Los dos síntomas eran el mismo error.
//
// La regla que queda: los paneles usan maxHeight "100%" y dejan que su
// contenedor —que ya sabe del teclado— mande. Este hook solo sirve para
// detalles cosméticos, como no dejar el margen de la barra de navegación
// cuando el teclado ya la está tapando.
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // En iOS conviene reaccionar antes de que termine la animación (will…);
    // en Android el aviso fiable llega cuando ya subió (did…).
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, () => setVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return visible;
}

// Se mantiene el nombre anterior para no tocar las tres pantallas que ya lo
// usan. Devuelve solo lo que de verdad hace falta.
export function useKeyboardOverlap() {
  return { keyboardVisible: useKeyboardVisible() };
}
