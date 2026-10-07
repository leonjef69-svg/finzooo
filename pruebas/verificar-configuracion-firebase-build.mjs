import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { validateFirebaseAndroid, prepareFirebaseAndroid } = require("../scripts/verificar-firebase-android.cjs");
const expected = { projectId: "demo-fino", senderId: "12345", packageName: "com.test.fino" };
const config = {
  project_info: { project_id: expected.projectId, project_number: expected.senderId },
  client: [{ client_info: { mobilesdk_app_id: "1:12345:android:abc", android_client_info: { package_name: expected.packageName } } }],
};
assert.doesNotThrow(() => validateFirebaseAndroid(config, expected));
assert.throws(() => validateFirebaseAndroid({ ...config, project_info: { ...config.project_info, project_id: "otro" } }, expected), /proyecto/);
assert.throws(() => validateFirebaseAndroid({ ...config, project_info: { ...config.project_info, project_number: "987" } }, expected), /remitente/);
assert.throws(() => validateFirebaseAndroid({ ...config, client: [] }, expected), /paquete/);
assert.throws(() => validateFirebaseAndroid(null, expected), /proyecto/);
const duplicate = { ...config, client: [...config.client, ...config.client] };
assert.throws(() => validateFirebaseAndroid(duplicate, expected), /paquete/);
const script = fs.readFileSync("generar-aab.bat", "utf8");
assert.doesNotMatch(script, /Downloads\\google-services\*/i);
const check = script.indexOf("node scripts\\verificar-firebase-android.cjs");
assert.ok(check >= 0 && check < script.indexOf("expo.cmd prebuild"), "Validar antes de regenerar Android");
assert.ok(script.includes("node scripts\\verificar-firebase-android.cjs --copy"));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "fino-firebase-build-"));
try {
  fs.mkdirSync(path.join(temp, "utils"));
  fs.mkdirSync(path.join(temp, "android/app"), { recursive: true });
  fs.writeFileSync(path.join(temp, "app.json"), JSON.stringify({ expo: { android: {
    package: expected.packageName, googleServicesFile: "./elegido.json",
  } } }));
  fs.writeFileSync(path.join(temp, "utils/firebase.ts"), `const firebaseConfig = {\n  projectId: "${expected.projectId}",\n  messagingSenderId: "${expected.senderId}",\n};`);
  const destination = path.join(temp, "android/app/google-services.json");
  fs.writeFileSync(destination, "original");
  fs.writeFileSync(path.join(temp, "elegido.json"), JSON.stringify(config));
  prepareFirebaseAndroid(temp);
  assert.equal(fs.readFileSync(destination, "utf8"), "original");
  prepareFirebaseAndroid(temp, true);
  assert.deepEqual(JSON.parse(fs.readFileSync(destination, "utf8")), config);
  fs.writeFileSync(path.join(temp, "elegido.json"), JSON.stringify({ ...config, client: [] }));
  assert.throws(() => prepareFirebaseAndroid(temp, true), /paquete/);
  assert.deepEqual(JSON.parse(fs.readFileSync(destination, "utf8")), config, "No sobrescribir con otra configuración");
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
console.log("AAB: Firebase de otro proyecto, remitente o paquete se rechaza antes de compilar; sin elección automática desde Descargas.");
