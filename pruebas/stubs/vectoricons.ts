// Los logos de marca no se dibujan al probar con Node: solo tienen que
// existir para que constants/iconos se pueda cargar.
//
// Hace falta un sustituto porque @expo/vector-icons trae TIPOGRAFIAS (.ttf) y
// esbuild no sabe empaquetar eso: sin esto, cinco pruebas que ni siquiera
// hablan de iconos dejaban de compilar con "No loader is configured for .ttf".
import glifos from "@/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json";
import glifosMarcas from "@/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/FontAwesome5Free.json";

const icono = () => null;

/**
 * Los dibujos genericos necesitan ademas estas tres piezas.
 *
 * Desde el 07/08/2026 constants/iconos no usa el componente de Expo para dibujar:
 * pide la tabla de letras y la pinta el mismo, porque el componente de Expo es una
 * clase con estado y con 227 iconos eso costaba segundos. Ver la nota de dibujo().
 *
 * La tabla que se devuelve es LA DE VERDAD, leida del propio paquete. Con una tabla
 * vacia, cada dibujo caeria en el camino de reserva y las pruebas recorrerian el
 * codigo que NO se usa en el celular.
 */
const conTipografia = Object.assign(icono, {
  getRawGlyphMap: () => glifos as Record<string, number>,
  getFontFamily: () => "material-community",
  loadFont: () => Promise.resolve(),
});

/**
 * Y LAS MARCAS IGUAL, DESDE EL 20/08/2026.
 *
 * Ese dia constants/iconos dejo tambien de usar el componente de Expo para los logos, por lo
 * mismo que los genericos. Ahora pide la tabla de letras de marcas y la tipografia.
 *
 * `font` es un mapa "familia -> archivo .ttf"; aqui vale un numero cualquiera, porque el
 * sustituto de expo-font ni lo mira. Lo que importa es que la CLAVE sea la misma familia que
 * devuelve getFontFamily, o al pedir la tipografia se pediria "undefined".
 */
const conTipografiaDeMarcas = Object.assign(() => null, {
  getRawGlyphMap: () => glifosMarcas as Record<string, number>,
  getFontFamily: () => "fontawesome5-brand",
  font: { "fontawesome5-brand": 1 },
});

export const FontAwesome5 = conTipografiaDeMarcas;
export const FontAwesome6 = icono;
export const FontAwesome = icono;
export const Ionicons = icono;
export const MaterialIcons = icono;
export const MaterialCommunityIcons = conTipografia;
export const AntDesign = icono;
export const Entypo = icono;
export const Feather = icono;

export default new Proxy({}, { get: () => icono });
