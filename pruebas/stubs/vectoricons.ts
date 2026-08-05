// Los logos de marca no se dibujan al probar con Node: solo tienen que
// existir para que constants/iconos se pueda cargar.
//
// Hace falta un sustituto porque @expo/vector-icons trae TIPOGRAFIAS (.ttf) y
// esbuild no sabe empaquetar eso: sin esto, cinco pruebas que ni siquiera
// hablan de iconos dejaban de compilar con "No loader is configured for .ttf".
const icono = () => null;

export const FontAwesome5 = icono;
export const FontAwesome6 = icono;
export const FontAwesome = icono;
export const Ionicons = icono;
export const MaterialIcons = icono;
export const MaterialCommunityIcons = icono;
export const AntDesign = icono;
export const Entypo = icono;
export const Feather = icono;

export default new Proxy({}, { get: () => icono });
