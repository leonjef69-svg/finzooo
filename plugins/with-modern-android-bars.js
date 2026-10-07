const { withAndroidStyles, withAppBuildGradle } = require("@expo/config-plugins");
const { configureSentryGradle } = require("./sentry-gradle-policy");

/**
 * Android 15 controla las barras del sistema cuando la app usa edge-to-edge.
 * El prebuild de algunas dependencias todavía vuelve a escribir atributos
 * obsoletos en AppTheme. Quitarlos aquí garantiza que cada AAB regenerado tenga
 * el mismo manifiesto moderno, aunque se borre por completo la carpeta android.
 */
module.exports = function withModernAndroidBars(config) {
  config = withAndroidStyles(config, (result) => {
    const styles = result.modResults.resources.style ?? [];
    const obsolete = new Set([
      "android:statusBarColor",
      "android:navigationBarColor",
      "android:enforceNavigationBarContrast",
    ]);
    for (const style of styles) {
      if (style.$?.name !== "AppTheme" || !Array.isArray(style.item)) continue;
      style.item = style.item.filter((item) => !obsolete.has(item.$?.name));
    }
    return result;
  });
  return withAppBuildGradle(config, (result) => {
    // La subida de mapas solo se activa con una decisión explícita y con las
    // credenciales privadas en el entorno de compilación, nunca en Git.
    result.modResults.contents = configureSentryGradle(result.modResults.contents);
    return result;
  });
};
