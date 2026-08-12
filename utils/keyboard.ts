import { useEffect, useRef, useState } from "react";
import { Keyboard, Platform } from "react-native";
import { isRunningInExpoGo } from "expo";
import {
  KeyboardState,
  useAnimatedKeyboard,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

// `useAnimatedKeyboard` (usado más abajo) no funciona dentro de Expo Go —
// solo en una app instalada de verdad (development build o producción).
// Dentro de Expo Go, esta pantalla se quedaba en blanco al abrirla. Se
// detecta una sola vez si estamos en Expo Go y, solo en ese caso, se usa
// un método de respaldo más simple (basado en eventos de JavaScript) para
// poder seguir probando la app ahí. Fuera de Expo Go se sigue usando el
// método bueno de siempre, sin ningún cambio.
const IS_EXPO_GO = isRunningInExpoGo();

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
function useCosmeticKeyboardVisible() {
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
  return keyboardVisible;
}

// Sin uso en el camino nativo (useAnimatedKeyboard ya resuelve todo solo,
// sin necesitar saber qué campo tiene el foco) — solo existe para que las
// pantallas puedan llamar onFieldFocus/onFieldBlur sin preguntar primero en
// qué entorno están corriendo.
const NOOP = (_fieldId?: string) => {};

function useKeyboardAnimatedPaddingNative() {
  const keyboard = useAnimatedKeyboard();

  /**
   * EL HUECO FANTASMA AL ABRIR UNA PANTALLA (12/08/2026).
   *
   * Reportado con la captura: entrar por primera vez a "Presupuestos por categoría" y
   * encontrarse media pantalla vacía debajo del botón, sin haber tocado ningún teclado.
   *
   * EL VALOR DE `useAnimatedKeyboard` ES COMPARTIDO POR TODA LA APP y sobrevive a que la
   * pantalla que lo usaba se cierre. Cuando la última se desmonta, Reanimated deja de escuchar
   * al teclado — y la siguiente arranca con el ÚLTIMO valor conocido, que puede ser "abierto,
   * 341 px" aunque en pantalla no haya ningún teclado. De ahí el hueco.
   *
   * Cerrar el teclado al salir no alcanza: si la pantalla se desmonta antes de que la animación
   * de cierre termine, lo que queda grabado sigue siendo "abierto".
   *
   * ESTO YA ESTABA RESUELTO EN AddSheet, escrito a mano dentro de esa pantalla. Al sacar el
   * mecanismo a esta pieza compartida, el arreglo se quedó allí — así que "Nuevo movimiento"
   * estaba a salvo y las tres que vinieron después, no. Es el fallo de siempre: la pieza se
   * comparte y la lección se queda en la casa vieja.
   *
   * Cómo se resuelve: al montar se pregunta con `Keyboard.isVisible()` si hay un teclado DE
   * VERDAD. Si no lo hay, se ignora cualquier altura heredada hasta que llegue una apertura
   * real.
   */
  const ignorarHeredado = useSharedValue(0);

  const animatedPaddingStyle = useAnimatedStyle(() => {
    if (ignorarHeredado.value === 1) return { paddingBottom: 0 };
    const estado = keyboard.state.value;
    const abierto = estado === KeyboardState.OPENING || estado === KeyboardState.OPEN;
    return { paddingBottom: abierto ? keyboard.height.value : 0 };
  });

  /**
   * En cuanto el teclado empieza a abrirse DE VERDAD, el valor deja de ser heredado.
   *
   * Dos detalles que en el primer intento estaban mal, y que se copian tal cual de AddSheet:
   *
   *  - Se ignora la PRIMERA lectura (prev === null). Esa primera lectura es exactamente el
   *    valor heredado que se quiere descartar; actuar sobre ella anularía la protección en el
   *    mismo instante de abrir la pantalla.
   *  - Solo cuenta OPENING, no OPEN. "Abierto" es el estado en el que se queda grabado el valor
   *    viejo; "abriéndose" solo puede venir de una transición real con la pantalla ya montada.
   */
  useAnimatedReaction(
    () => keyboard.state.value,
    (estado, previo) => {
      if (previo === null) return;
      if (estado === KeyboardState.OPENING) {
        ignorarHeredado.value = 0;
      }
    }
  );

  useEffect(() => {
    ignorarHeredado.value = Keyboard.isVisible() ? 0 : 1;
    // Y si Android confirma que el teclado se abrió, se vuelve a confiar en el valor nativo.
    const sub = Keyboard.addListener("keyboardDidShow", () => {
      ignorarHeredado.value = 0;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    animatedPaddingStyle,
    keyboardVisible: useCosmeticKeyboardVisible(),
    onFieldFocus: NOOP,
    onFieldBlur: NOOP,
  };
}

// Respaldo SOLO para Expo Go.
//
// Por qué esto NUNCA puede ser tan confiable como el método nativo de
// arriba (hay que ser honestos sobre esta limitación): desde que Android
// 15 desactivó el ajuste automático de pantalla para apps "edge to edge"
// (esta app lo es — ver app.json), el sistema operativo YA NO avisa ni
// ajusta nada solo. `useAnimatedKeyboard` (Reanimated) lo resuelve
// enganchándose directo a un valor que el sistema operativo empuja cuadro
// a cuadro — pero ESE mecanismo no funciona dentro de Expo Go (limitación
// documentada de Reanimated, no de este código). La única alternativa
// disponible en Expo Go es JavaScript puro, que depende de un aviso
// (`keyboardDidShow`) que Android NO garantiza repetir al saltar de un
// campo a otro sin cerrar el teclado del todo — confirmado con la app
// real: pasaba en Descripción/Notas, a veces sí y a veces no.
//
// Intento anterior (insuficiente): esperar pasivamente ese aviso para
// saber cuánto mide el teclado. Cuando el aviso no llegaba, el código
// seguía creyendo que el teclado medía 0, y el panel de Guardar/Cancelar
// quedaba tapado aunque el teclado sí estuviera ocupando espacio real.
//
// Mejora real de este archivo: en vez de esperar el aviso, se usa
// `Keyboard.metrics()` — una función que le PREGUNTA a Android, en el
// instante exacto en que se toca un campo, "¿el teclado ya está abierto
// ahora mismo, y cuánto mide?". Si el teclado ya estaba abierto (el caso
// de saltar de campo a campo, que es justo el que fallaba), esto responde
// al instante, sin depender de ningún aviso que se pueda perder. El aviso
// `keyboardDidShow` se sigue usando SOLO para la PRIMERA vez que el
// teclado aparece desde cerrado (ahí `metrics()` todavía no tiene nada
// que responder porque el teclado recién está animándose hacia arriba).
//
// Aun así, esto sigue siendo JavaScript, no el sistema operativo empujando
// un valor cuadro a cuadro — el único 100% determinista es el método
// nativo de arriba, disponible solo en una development build.
//
// onFieldBlur espera un instante antes de esconder el panel: si en ese
// instante llega un onFieldFocus del SIGUIENTE campo (que es exactamente
// lo que pasa al saltar de un campo a otro), se cancela el escondido y no
// se ve ningún parpadeo.
//
// Bug encontrado con capturas reales (segunda ronda): lo de arriba asume
// que primero se recibe el "salí del campo viejo" y DESPUÉS el "entré al
// campo nuevo" — pero Android no garantiza ese orden. Cuando llega al
// revés (primero "entré al nuevo", el "salí del viejo" llega después),
// el aviso tardío de salida ya no tiene nada que lo cancele, y esconde el
// panel unos milisegundos después de que ya se estaba escribiendo en el
// campo nuevo. Confirmado con la app real: pasaba en cualquier campo, sin
// patrón fijo — justo la firma de un problema de orden, no de datos.
//
// Corrección: en vez de que cada campo cancele "el aviso de escondido más
// reciente" a ciegas, se guarda CUÁL campo fue el último en recibir foco.
// Cuando un campo pierde el foco, espera su instante y solo esconde el
// panel si, pasado ese instante, SIGUE siendo el último campo que tuvo
// foco (o sea: nadie más lo tomó mientras tanto, sin importar en qué
// orden llegaron los avisos).
function useKeyboardAnimatedPaddingFallback() {
  const height = useSharedValue(0);
  const visible = useSharedValue(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFocusedField = useRef<string | undefined>(undefined);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const sub = Keyboard.addListener(showEvent, (e) => {
      height.value = withTiming(e.endCoordinates?.height ?? 0, { duration: 200 });
    });
    return () => sub.remove();
  }, [height]);

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  function onFieldFocus(fieldId?: string) {
    lastFocusedField.current = fieldId;
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    // Pregunta directa: si el teclado YA está abierto (saltar de campo a
    // campo), esto responde al instante con la medida real — sin esperar
    // ningún aviso que Android podría no repetir.
    const metrics = Keyboard.metrics();
    if (metrics) {
      height.value = metrics.height;
    }
    visible.value = withTiming(1, { duration: 150 });
    setKeyboardVisible(true);
  }

  function onFieldBlur(fieldId?: string) {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      hideTimer.current = null;
      // Si otro campo ya tomó el foco (aunque su aviso de "entré" haya
      // llegado ANTES que este de "salí"), lastFocusedField.current ya no
      // es este mismo campo — no se esconde nada.
      if (lastFocusedField.current !== fieldId) return;
      visible.value = withTiming(0, { duration: 200 });
      setKeyboardVisible(false);
    }, 80);
  }

  const animatedPaddingStyle = useAnimatedStyle(() => ({
    paddingBottom: visible.value * height.value,
  }));

  return { animatedPaddingStyle, keyboardVisible, onFieldFocus, onFieldBlur };
}

export function useKeyboardAnimatedPadding() {
  // IS_EXPO_GO nunca cambia mientras la app está corriendo, así que esta
  // rama siempre toma el mismo camino en cada render de un mismo montaje
  // — no rompe la regla de "mismos hooks en el mismo orden siempre".
  if (IS_EXPO_GO) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useKeyboardAnimatedPaddingFallback();
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useKeyboardAnimatedPaddingNative();
}
