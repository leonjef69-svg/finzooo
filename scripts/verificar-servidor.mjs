import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (Number(process.versions.node.split(".")[0]) !== 22) {
  throw new Error("Esta comprobación requiere Node 22 real; no cuenta como validada con otra versión.");
}
const configPath = path.join(root, "firebase.pruebas.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
if (config.functions?.source !== "functions" || config.functions?.runtime !== "nodejs22"
  || Object.values(config.emulators).filter(value => typeof value === "object" && "host" in value).some(value => value.host !== "127.0.0.1")) {
  throw new Error("Configuración de pruebas inesperada; no se inicia Firebase.");
}
// No cargar configuraciones/secretos locales reales ni descargarlos de Google.
for (const name of [".env", ".env.local", ".env.demo-fino-node22", ".secret.local"]) {
  if (fs.existsSync(path.join(root, "functions", name))) throw new Error(`Retira de esta prueba aislada la configuración ${name}; no se leerá.`);
}
const require = createRequire(import.meta.url);
const cli = process.env.FINO_FIREBASE_CLI || require.resolve("firebase-tools/lib/bin/firebase.js");
if (!fs.existsSync(cli)) throw new Error("No se encontró Firebase CLI para las pruebas locales.");
const env = { ...process.env, FIREBASE_CLI_DISABLE_USAGE: "1", FUNCTIONS_DISCOVERY_TIMEOUT: "60", CI: "true" };
const hostPath = process.env.PATH || process.env.Path || "";
for (const key of Object.keys(env)) if (key.toUpperCase() === "PATH") delete env[key];
env.PATH = `${path.dirname(process.execPath)}${path.delimiter}${hostPath}`;
delete env.GOOGLE_APPLICATION_CREDENTIALS;
const result = spawnSync(process.execPath, [cli, "emulators:exec", "--only", "auth,functions,firestore",
  "--project", "demo-fino-node22", "--config", configPath,
  "node --test --test-concurrency=1 functions/emulator-tests/*.test.js functions/integration-tests/*.test.js"], { cwd: root, env, stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
