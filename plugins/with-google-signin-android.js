const { AndroidConfig, createRunOncePlugin, withPlugins } = require("expo/config-plugins");
const pkg = require("@react-native-google-signin/google-signin/package.json");

/**
 * Fino todavía no tiene un cliente OAuth de iOS. El plugin oficial sin un
 * GoogleService-Info.plist intenta configurar también iPhone y deja la
 * compilación incompleta. Android sí tiene google-services.json y conserva
 * exactamente sus tres pasos nativos. En iOS se ofrece correo/contraseña
 * hasta que exista la credencial real; no se inventa una identidad de Google.
 */
function withGoogleSignInAndroid(config) {
  return withPlugins(config, [
    AndroidConfig.GoogleServices.withClassPath,
    AndroidConfig.GoogleServices.withApplyPlugin,
    AndroidConfig.GoogleServices.withGoogleServicesFile,
  ]);
}

module.exports = createRunOncePlugin(
  withGoogleSignInAndroid,
  "with-google-signin-android",
  pkg.version,
);
