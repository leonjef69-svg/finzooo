import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
const require = createRequire(import.meta.url);
const root = process.cwd();
const cache = path.join(root, ".gradle-cache/wrapper/dists/gradle-8.14.3-bin");
const candidates = fs.readdirSync(cache).map(name => path.join(cache, name, "gradle-8.14.3/lib"));
const lib = candidates.find(candidate => fs.existsSync(path.join(candidate, "groovy-3.0.24.jar")));
if (!lib) throw Error("No está disponible el Groovy local de Gradle; prueba JVM pendiente.");
const java = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, "bin/java.exe") : "C:/Program Files/Android/Android Studio/jbr/bin/java.exe";
if (!fs.existsSync(java)) throw Error("No está disponible Java local; prueba JVM pendiente.");
const { configureReleaseSigningGradle } = require("../plugins/with-android-release-guard.js");
const full = configureReleaseSigningGradle("android {}\n");
const policy = full.slice(full.indexOf("// FINO_RELEASE_SIGNING_BEGIN"));
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "finzo-signing-test-"));
const file = path.join(temporary, "policy.gradle");
try {
  fs.writeFileSync(file, policy);
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.toUpperCase().startsWith("FINZO_")) delete env[key];
  for (const mode of ["missing", "fake-present"]) {
    const testEnv = mode === "missing" ? env : { ...env, FINZO_STORE_FILE: "dummy-upload.keystore",
      FINZO_KEY_ALIAS: "dummy-upload-key", FINZO_STORE_PASSWORD: "dummy-only-test", FINZO_KEY_PASSWORD: "dummy-only-test" };
    process.stdout.write(execFileSync(java, ["-cp", path.join(lib, "*"), "groovy.ui.GroovyMain", "pruebas/native/release-policy/ReleasePolicyTest.groovy", file, mode], { cwd: root, env: testEnv, encoding: "utf8" }));
  }
} finally {
  // Solo el archivo exacto recién creado y su carpeta temporal vacía.
  fs.unlinkSync(file);
  fs.rmdirSync(temporary);
}
