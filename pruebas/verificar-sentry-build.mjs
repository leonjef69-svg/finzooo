import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";

const require = createRequire(import.meta.url);
const { configureSentryGradle } = require("../plugins/sentry-gradle-policy.js");
const { modifyAppBuildGradle } = require("@sentry/react-native/plugin/build/withSentryAndroid.js");
const { withPlugins } = require("@expo/config-plugins");

const sentryLine = 'apply from: new File(["node", "--print", "require(\'path\').dirname(require.resolve(\'@sentry/react-native/package.json\'))"].execute().text.trim(), "sentry.gradle")';
const gradle = `plugins { id "com.android.application" }\n${sentryLine}\nandroid {}`;

assert.equal(configureSentryGradle(gradle, {}), 'plugins { id "com.android.application" }\nandroid {}');
assert.equal(configureSentryGradle(gradle, {
  SENTRY_AUTH_TOKEN: "test-token",
  SENTRY_ORG: "test-org",
  SENTRY_PROJECT: "test-project",
}), 'plugins { id "com.android.application" }\nandroid {}');
assert.throws(() => configureSentryGradle(gradle, {
  FINO_SENTRY_UPLOAD_SOURCE_MAPS: "YES",
  SENTRY_ORG: "test-org",
  SENTRY_PROJECT: "test-project",
}), /SENTRY_AUTH_TOKEN/);
assert.throws(() => configureSentryGradle("android {}", {
  FINO_SENTRY_UPLOAD_SOURCE_MAPS: "YES",
  SENTRY_AUTH_TOKEN: "test-token",
  SENTRY_ORG: "test-org",
  SENTRY_PROJECT: "test-project",
}), /sentry\.gradle/);
assert.equal(configureSentryGradle(gradle, {
  FINO_SENTRY_UPLOAD_SOURCE_MAPS: "YES",
  SENTRY_AUTH_TOKEN: "test-token",
  SENTRY_ORG: "test-org",
  SENTRY_PROJECT: "test-project",
}), gradle);

const uploadEnv = {
  FINO_SENTRY_UPLOAD_SOURCE_MAPS: "YES",
  SENTRY_AUTH_TOKEN: "test-token",
  SENTRY_ORG: "test-org",
  SENTRY_PROJECT: "test-project",
};
assert.throws(() => configureSentryGradle(gradle, {
  ...uploadEnv, SENTRY_DISABLE_AUTO_UPLOAD: "true",
}), /SENTRY_DISABLE_AUTO_UPLOAD/);
const generated = modifyAppBuildGradle("android {\n}\n");
assert.match(configureSentryGradle(generated, uploadEnv), /sentry\.gradle/);
assert.doesNotMatch(configureSentryGradle(generated, {}), /sentry\.gradle/);
assert.equal(configureSentryGradle(configureSentryGradle(generated, {}), {}), configureSentryGradle(generated, {}));
const app = JSON.parse(fs.readFileSync(new URL("../app.json", import.meta.url), "utf8"));
const official = app.expo.plugins.indexOf("@sentry/react-native/expo");
assert.ok(official >= 0);
// Expo ejecuta los mods en orden inverso al registro. Ejecutar la cadena real
// detecta si la protección quita la línea antes de que Sentry la añada.
const pluginPaths = app.expo.plugins.filter(p => typeof p === "string" &&
  (p === "@sentry/react-native/expo" || p === "./plugins/with-modern-android-bars"));
const saved = Object.fromEntries([...Object.keys(uploadEnv), "SENTRY_DISABLE_AUTO_UPLOAD"]
  .map(key => [key, process.env[key]]));
try {
  for (const enabled of [false, true]) {
    for (const key of Object.keys(saved)) delete process.env[key];
    if (enabled) Object.assign(process.env, uploadEnv);
    const config = withPlugins({ name: "Test", slug: "test", _internal: { projectRoot: process.cwd() } }, pluginPaths);
    const result = await config.mods.android.appBuildGradle({
      ...config, modRequest: { projectRoot: process.cwd(), platform: "android", modName: "appBuildGradle" },
      modResults: { language: "groovy", contents: "android {\n}\n" },
    });
    assert.equal(result.modResults.contents.includes("sentry.gradle"), enabled);
    assert.ok(!result.modResults.contents.includes("test-token"));
  }
} finally {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

console.log("La subida de mapas exige activación y credenciales; el AAB normal mantiene su comportamiento.");
