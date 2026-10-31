import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

const baseline = process.env.FINO_TEST_RELEASE_POLICY_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw Error("Se requiere hash Git.");
const read = file => baseline ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
const app = JSON.parse(read("app.json")).expo;
const packageLock = JSON.parse(read("package-lock.json"));
assert.equal(app.version, "1.0.9", "El AAB nuevo debe mostrar una versión distinta en Play");
assert.equal(app.android.versionCode, 11, "Cada AAB de Play necesita un código mayor que el anterior");
assert.equal(packageLock.version, app.version, "package-lock debe coincidir con la versión comercial");
assert.equal(packageLock.packages[""].version, app.version, "La raíz de package-lock debe coincidir con la versión comercial");
assert.ok(app.plugins.includes("./plugins/with-android-release-guard"), "La configuración reconstruida debe conservar firma y componentes privados");
const require = createRequire(import.meta.url), module = { exports: {} };
vm.runInNewContext(read("plugins/with-android-release-guard.js"), { module, exports: module.exports, require });
const plugin = module.exports;
const template = execFileSync("tar", ["-xOf", "node_modules/expo/template.tgz", "package/android/app/build.gradle"], { encoding: "utf8" });
assert.match(template, /signingConfig signingConfigs.debug/);
const signed = plugin.configureReleaseSigningGradle(template);
assert.equal(plugin.configureReleaseSigningGradle(signed), signed, "Prebuild repetido no duplica firma");
assert.equal(signed.slice(0, template.trimEnd().length), template.trimEnd(), "No borra configuración SDK");
assert.match(signed, /buildTypes\.release\.signingConfig signingConfigs\.release/);
for (const key of ["FINZO_STORE_FILE", "FINZO_STORE_PASSWORD", "FINZO_KEY_ALIAS", "FINZO_KEY_PASSWORD"]) {
  assert.match(signed, new RegExp(`System.getenv\\("${key}"\\)`));
}
assert.ok(signed.indexOf("buildTypes.release.signingConfig signingConfigs.release") > signed.lastIndexOf("signingConfig signingConfigs.debug"));
assert.match(signed, /gradle\.taskGraph\.whenReady/);
assert.match(signed, /task\.project == project/);
assert.match(signed, /!finoSigningReady/);
assert.throws(() => plugin.configureReleaseSigningGradle("plugins {}"), /No se reconoce/);
assert.throws(() => plugin.configureReleaseSigningGradle(template + "\n// FINO_RELEASE_SIGNING_BEGIN"), /incompleta/);
assert.throws(() => plugin.configureReleaseSigningGradle(signed + "\n// FINO_RELEASE_SIGNING_BEGIN"), /duplicada/);
assert.throws(() => plugin.configureReleaseSigningGradle(template + "\n// FINO_RELEASE_SIGNING_END"), /incompleta/);
const previousConfiguration = template + "\nandroid { signingConfigs { release { storeFile file('outside-repo.keystore') } } }\n";
const existing = plugin.configureReleaseSigningGradle(previousConfiguration);
assert.equal(plugin.configureReleaseSigningGradle(existing), existing);
assert.ok(existing.includes(previousConfiguration.trimEnd()));

const optimized = plugin.configureReleaseBundleSources(signed);
assert.equal(plugin.configureReleaseBundleSources(optimized), optimized, "Prebuild repetido no duplica exclusiones");
assert.match(optimized, /proguard-android-optimize\.txt/, "La plantilla SDK 54 debe conservar reglas optimizadas R8");
assert.match(optimized, /sources\.exclude\("\.tmp\/\*\*", "\*\*\/.tmp\/\*\*"\)/, "La compilación no inspecciona temporales locales ajenos a la app");
assert.throws(() => plugin.configureReleaseBundleSources("plugins {}"), /No se reconoce/);
assert.throws(() => plugin.configureReleaseBundleSources(optimized + "\n// FINO_RELEASE_BUNDLE_EXCLUDES_BEGIN"), /duplicada/);

const gradleProperties = [{ type: "comment", value: "# Mantener comentarios previos" }, { type: "property", key: "android.enableMinifyInReleaseBuilds", value: "false" }];
plugin.configureReleaseGradleProperties(gradleProperties);
assert.equal(JSON.stringify(gradleProperties.filter(item => item.type === "property")), JSON.stringify([
  { type: "property", key: "android.enableMinifyInReleaseBuilds", value: "true" },
  { type: "property", key: "android.enableShrinkResourcesInReleaseBuilds", value: "true" },
]));
assert.equal(plugin.configureReleaseGradleProperties(gradleProperties), gradleProperties, "Prebuild repetido no duplica propiedades R8");
assert.throws(() => plugin.configureReleaseGradleProperties([{ type: "property", key: "android.enableMinifyInReleaseBuilds", value: "false" }, { type: "property", key: "android.enableMinifyInReleaseBuilds", value: "false" }]), /duplicada/);

const manifest = { manifest: { $: { "xmlns:android": "http://schemas.android.com/apk/res/android" }, application: [{
  $: { "android:allowBackup": "false" },
  activity: [{ $: { "android:name": ".MainActivity", "android:exported": "true" }, "intent-filter": [{ action: [{ $: { "android:name": "android.intent.action.MAIN" } }] }] },
    { $: { "android:name": "com.canhub.cropper.CropImageActivity", "android:theme": "@style/Crop", "tools:replace": "android:theme" } }],
  provider: [{ $: { "android:name": "expo.modules.clipboard.ClipboardFileProvider", "android:exported": "true" } }],
  receiver: [{ $: { "android:name": "com.finzo.exportscheduler.FinzoBootReceiver", "android:exported": "true" } }],
}] } };
const originalLauncher = JSON.stringify(manifest.manifest.application[0].activity[0]);
plugin.configurePrivateAndroidComponents(manifest);
const once = JSON.stringify(manifest); plugin.configurePrivateAndroidComponents(manifest);
assert.equal(JSON.stringify(manifest), once);
const activities = manifest.manifest.application[0].activity;
assert.equal(activities.find(x => x.$["android:name"] === "androidx.compose.ui.tooling.PreviewActivity").$["tools:node"], "remove");
const crop = activities.find(x => x.$["android:name"] === "com.canhub.cropper.CropImageActivity");
assert.equal(crop.$["android:exported"], "false");
assert.equal(crop.$["android:theme"], "@style/Crop");
assert.equal(crop.$["tools:replace"], "android:theme,android:exported");
assert.equal(JSON.stringify(activities[0]), originalLauncher, "Conserva arranque/enlaces/importación");
assert.equal(manifest.manifest.application[0].receiver[0].$["android:exported"], "true", "No rompe arranque legítimo del teléfono");
assert.equal(manifest.manifest.application[0].provider[0].$["android:exported"], "true", "No falsear proveedor que exige exposición y provocaría cierre");
assert.throws(() => plugin.configurePrivateAndroidComponents({ manifest: {} }), /application/);

// Ejecuta los mods reales de Expo (no una copia de su registro de plugins).
const configured = plugin({});
const request = { projectRoot: process.cwd(), platform: "android" };
const result = await configured.mods.android.appBuildGradle({ ...configured, modRequest: { ...request, modName: "appBuildGradle" }, modResults: { language: "groovy", contents: template } });
assert.equal(result.modResults.contents, optimized);
await assert.rejects(configured.mods.android.appBuildGradle({ ...configured, modRequest: request, modResults: { language: "kotlin", contents: template } }), /lenguaje no compatible/);
const propertiesResult = await configured.mods.android.gradleProperties({ ...configured, modRequest: { ...request, modName: "gradleProperties" }, modResults: [] });
assert.equal(JSON.stringify(propertiesResult.modResults.filter(item => item.type === "property")), JSON.stringify(gradleProperties.filter(item => item.type === "property")));
const manifestResult = await configured.mods.android.manifest({ ...configured, modRequest: { ...request, modName: "manifest" }, modResults: structuredClone(manifest) });
assert.equal(JSON.stringify(manifestResult.modResults), once);
const clipboardPaths = fs.readFileSync("node_modules/expo-clipboard/android/src/main/res/xml/clipboard_provider_paths.xml", "utf8");
assert.match(clipboardPaths, /<cache-path name="clipboard_files" path="\.clipboard\/"/);
assert.ok(!clipboardPaths.includes("root-path"));
const buildScript = fs.readFileSync("generar-aab.bat", "utf8");
assert.match(buildScript, /GRADLE_USER_HOME=.*\.gradle-cache/i, "La entrega reutiliza la caché Gradle local si está instalada");
console.log("Release: versión Play, plugin Expo 54 y propiedades R8 idempotentes; exclusión de temporales y caché local; firma sin secretos y componentes Android conservados.");
