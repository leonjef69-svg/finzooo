const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const { createRequire } = require("module");
const path = require("path");

const config = getDefaultConfig(__dirname);
const requireFromNativeWind = createRequire(require.resolve("nativewind/package.json"));
const cssInteropRoot = path.dirname(requireFromNativeWind.resolve("react-native-css-interop/package.json"));
const defaultResolveRequest = config.resolver.resolveRequest;

// NativeWind y la app deben compartir exactamente la misma instancia del
// motor de estilos. Una instalación mezclada npm/pnpm podía cargar dos copias.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "react-native-css-interop" || moduleName.startsWith("react-native-css-interop/")) {
    const suffix = moduleName.slice("react-native-css-interop".length);
    return context.resolveRequest(context, path.join(cssInteropRoot, suffix), platform);
  }
  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, {
  input: "./global.css",
  // En Windows y con pnpm, el módulo virtual puede quedar vacío después de
  // limpiar la caché. Escribir el resultado evita que la app arranque sin estilos.
  forceWriteFileSystem: true,
});
