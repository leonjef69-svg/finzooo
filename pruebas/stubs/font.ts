// Sustituto de expo-font para las pruebas.
//
// Hace falta desde el 07/08/2026: constants/iconos dejo de usar el componente de
// Expo para dibujar y ahora pinta la letra el mismo, asi que pregunta a expo-font si
// la tipografia esta cargada. El de verdad arrastra expo-asset, que esbuild no sabe
// resolver — y con eso dejaban de compilar OCHO pruebas que no hablan de iconos.
//
// Se responde que SI esta cargada, para que las pruebas recorran el camino normal —
// el de pintar la letra— y no el de reserva.

export function isLoaded(): boolean {
  return true;
}

export function loadAsync(): Promise<void> {
  return Promise.resolve();
}
