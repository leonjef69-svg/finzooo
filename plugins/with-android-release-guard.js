const { withAndroidManifest, withAppBuildGradle } = require("expo/config-plugins");

const BEGIN = "// FINO_RELEASE_SIGNING_BEGIN";
const END = "// FINO_RELEASE_SIGNING_END";
// Se guardan nombres de variables, nunca valores privados ni una clave en Git.
const SIGNING = String.raw`
${BEGIN}
def finoReleaseStoreFile = System.getenv("FINZO_STORE_FILE") ?: findProperty("FINZO_STORE_FILE")
def finoReleaseStorePassword = System.getenv("FINZO_STORE_PASSWORD")
def finoReleaseKeyAlias = System.getenv("FINZO_KEY_ALIAS") ?: findProperty("FINZO_KEY_ALIAS")
def finoReleaseKeyPassword = System.getenv("FINZO_KEY_PASSWORD")
def finoSigningReady = finoReleaseStoreFile && finoReleaseStorePassword && finoReleaseKeyAlias && finoReleaseKeyPassword
if (gradle.startParameter.taskNames.any { it.toLowerCase().contains("release") } && !finoSigningReady) {
    throw new GradleException("Faltan las credenciales de firma FINZO_* en las variables de entorno.")
}
android {
    signingConfigs {
        release {
            storeFile finoReleaseStoreFile ? file(finoReleaseStoreFile) : null
            storePassword finoReleaseStorePassword ?: ""
            keyAlias finoReleaseKeyAlias ?: ""
            keyPassword finoReleaseKeyPassword ?: ""
        }
    }
    buildTypes.release.signingConfig signingConfigs.release
}
// También protege tareas agregadas como 'build', que no contienen 'release'.
gradle.taskGraph.whenReady { graph ->
    def needsReleaseSigning = graph.allTasks.any { task ->
        task.project == project && task.name ==~ /(?i)(assemble|bundle|package|validateSigning|install).*release.*/
    }
    if (needsReleaseSigning && !finoSigningReady) {
        throw new GradleException("Faltan las credenciales de firma FINZO_* en las variables de entorno.")
    }
}
${END}
`;

function configureReleaseSigningGradle(contents) {
  if (typeof contents !== "string" || !/android\s*\{/.test(contents)) {
    throw new Error("No se reconoce el build.gradle Android; revisar la firma antes de compilar.");
  }
  const first = contents.indexOf(BEGIN);
  if (first !== -1) {
    const last = contents.indexOf(END, first);
    if (last === -1 || contents.indexOf(BEGIN, first + BEGIN.length) !== -1) {
      throw new Error("Configuración de firma incompleta o duplicada; no se sustituye a ciegas.");
    }
    contents = contents.slice(0, first) + contents.slice(last + END.length);
  } else if (contents.includes(END)) {
    throw new Error("Configuración de firma incompleta; no se sustituye a ciegas.");
  }
  return contents.trimEnd() + "\n" + SIGNING.trim() + "\n";
}

function configurePrivateAndroidComponents(manifest) {
  manifest.manifest.$ ??= {};
  manifest.manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";
  const app = manifest.manifest.application?.[0];
  if (!app) throw new Error("Manifiesto sin application; revisar la protección Android.");
  app.activity ??= [];
  for (const name of ["androidx.compose.ui.tooling.PreviewActivity", "com.canhub.cropper.CropImageActivity"]) {
    let activity = app.activity.find(item => item.$?.["android:name"] === name);
    if (!activity) { activity = { $: { "android:name": name } }; app.activity.push(activity); }
    if (name === "androidx.compose.ui.tooling.PreviewActivity") {
      activity.$["tools:node"] = "remove";
    } else {
      // Conserva el recortador interno; solo impide invocarlo desde otra app.
      activity.$["android:exported"] = "false";
      const replace = new Set((activity.$["tools:replace"] ?? "").split(",").map(value => value.trim()).filter(Boolean));
      replace.add("android:exported");
      activity.$["tools:replace"] = [...replace].join(",");
    }
  }
  // ClipboardFileProvider exige exported=true en su propio attachInfo.
  // No se falsea ni se elimina: solo expone cache/.clipboard/, no el historial.
  return manifest;
}

function withAndroidReleaseGuard(config) {
  config = withAndroidManifest(config, result => {
    result.modResults = configurePrivateAndroidComponents(result.modResults);
    return result;
  });
  return withAppBuildGradle(config, result => {
    if (result.modResults.language !== "groovy") throw new Error("Firma Android: lenguaje no compatible; revisar antes de publicar.");
    result.modResults.contents = configureReleaseSigningGradle(result.modResults.contents);
    return result;
  });
}

module.exports = withAndroidReleaseGuard;
module.exports.configureReleaseSigningGradle = configureReleaseSigningGradle;
module.exports.configurePrivateAndroidComponents = configurePrivateAndroidComponents;
