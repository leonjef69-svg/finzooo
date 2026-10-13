const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const { withNativeWind } = require("nativewind/metro");
const { createRequire } = require("module");
const path = require("path");

const config = getSentryExpoConfig(__dirname);
// Las pruebas crean y retiran carpetas bajo .tmp. No son fuentes de la app:
// vigilarlas en Windows podía cerrar Metro con ENOENT al desaparecer una.
// Conservamos también las exclusiones que Expo/Sentry ya traen.
const existingBlockList = config.resolver.blockList;
const escapedProjectRoot = __dirname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\\/g, "[\\\\/]");
const generatedDirectories = new RegExp(
  `^${escapedProjectRoot}[\\\\/](?:\\.tmp(?:-\\d+)?|\\.gradle-cache|\\.pnpm-store|\\.android-user|output)(?:[\\\\/].*)?$`,
);
config.resolver.blockList = [
  ...(Array.isArray(existingBlockList) ? existingBlockList : existingBlockList ? [existingBlockList] : []),
  generatedDirectories,
  new RegExp(`^${escapedProjectRoot}[\\\\/]pruebas[\\\\/]\\.tmp-\\d+(?:[\\\\/].*)?$`),
];
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
});
