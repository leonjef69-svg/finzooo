// Sustituto de react-native para poder probar con Node.
//
// Las pruebas cargan archivos de la app, y la app habla con Android. Aqui no
// hay Android: se cambia react-native por esto, que no hace nada. Lo que se
// comprueba son las CUENTAS y el TEXTO que sale, no el dibujado.
//
// Antes habia dos sustitutos distintos —uno con unas piezas y otro con
// otras— y cada prueba usaba el suyo. Asi es como se llego a tener pruebas
// que ya no compilaban sin que nadie se enterara. Ahora es uno solo: si a
// alguna le falta algo, se anade aqui y lo tienen todas.

export const Platform = { OS: "android" };

// --- Componentes: solo tienen que existir ---
export const View = null;
export const Text = null;
export const TextInput = null;
export const ScrollView = null;
export const TouchableOpacity = null;
export const ActivityIndicator = null;
export const Pressable = null;
export const FlatList = null;
export const Modal = null;
export const Switch = null;
export const Image = { getSize: () => {} };

// --- Piezas que piden los modulos de Expo al cargarse ---
export const NativeModules: Record<string, unknown> = {};
export const AppRegistry = { registerComponent() {}, runApplication() {} };
export const TurboModuleRegistry = {
  get: () => null,
  getEnforcing: () => {
    throw new Error("sin modulos nativos en las pruebas");
  },
};

export class NativeEventEmitter {
  addListener() {
    return { remove() {} };
  }
  removeAllListeners() {}
  emit() {}
}

export const DeviceEventEmitter = {
  addListener: () => ({ remove() {} }),
  removeAllListeners() {},
  emit() {},
};

// --- Medidas y estado del sistema ---
//
// Densidad 1 y una pantalla fija: los tamanos se comprueban en puntos, no en
// pixeles de un celular concreto.
export const PixelRatio = {
  get: () => 1,
  getFontScale: () => 1,
  roundToNearestPixel: (n: number) => Math.round(n),
};

export const Dimensions = {
  get: () => ({ width: 400, height: 800, scale: 1, fontScale: 1 }),
  addEventListener: () => ({ remove() {} }),
};

export const AppState = {
  currentState: "active",
  addEventListener: () => ({ remove() {} }),
};

export const BackHandler = {
  addEventListener: () => ({ remove() {} }),
  removeEventListener() {},
};

export const Linking = {
  openURL: async () => {},
  addEventListener: () => ({ remove() {} }),
};

export const StyleSheet = {
  create: <T,>(x: T) => x,
  flatten: <T,>(x: T) => x,
  absoluteFillObject: {},
};

export const PanResponder = { create: () => ({ panHandlers: {} }) };

export const Animated = {
  View: null,
  Text: null,
  Value: class {
    setValue() {}
    interpolate() {
      return 0;
    }
  },
  timing: () => ({ start() {} }),
  spring: () => ({ start() {} }),
  loop: () => ({ start() {}, stop() {} }),
  sequence: () => ({ start() {} }),
};

export const Easing = {
  out: (f: unknown) => f,
  in: (f: unknown) => f,
  inOut: (f: unknown) => f,
  ease: 0,
  cubic: 0,
};

export function useWindowDimensions() {
  return { width: 400, height: 800, scale: 1, fontScale: 1 };
}

export function useColorScheme() {
  return "light";
}
