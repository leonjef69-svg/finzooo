// SUSTITUTO DE react-native-reanimated PARA LAS PRUEBAS
//
// Reanimated arranca su parte nativa NADA MAS cargarse, y aqui no hay Android: el proceso se
// caia al importar, antes incluso de llegar a la primera comprobacion.
//
// Llego el 13/08/2026, cuando la pantalla de recortar la foto paso a mover la imagen sin
// redibujar. Hasta entonces ninguna prueba llegaba a cargar reanimated de rebote; con ese cambio
// si, y verificar-categorias —que no habla de imagenes ni de animaciones— dejo de compilar.
//
// Aqui no se anima nada a proposito. Estas pruebas comprueban CUENTAS, y una animacion no tiene
// ninguna: lo unico que hace falta es que cargar el archivo no reviente.
const Animated = {
  View: null,
  Text: null,
  Image: null,
  ScrollView: null,
};
export default Animated;

export const useSharedValue = <T,>(inicial: T) => ({ value: inicial });
export const useAnimatedStyle = (fn: () => unknown) => fn;
export const useAnimatedReaction = () => undefined;
export const useAnimatedKeyboard = () => ({ height: { value: 0 }, state: { value: 0 } });
export const withSpring = <T,>(v: T) => v;
export const withTiming = <T,>(v: T) => v;
export const runOnJS = <T,>(fn: T) => fn;
export const KeyboardState = { UNKNOWN: 0, OPENING: 1, OPEN: 2, CLOSING: 3, CLOSED: 4 };
export const FadeInDown = { duration: () => FadeInDown, delay: () => FadeInDown };
export const ZoomIn = { duration: () => ZoomIn, delay: () => ZoomIn };
export const Easing = { out: () => undefined, inOut: () => undefined, ease: undefined };
export const interpolate = () => 0;
