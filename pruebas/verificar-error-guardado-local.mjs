import fs from "node:fs";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import * as esbuild from "esbuild";

const storage = fs.readFileSync("utils/storage.ts", "utf8");
const contexto = fs.readFileSync("contexts/AppDataContext.tsx", "utf8");
const cloud = fs.readFileSync("utils/cloudSync.ts", "utf8");
const businessCloud = fs.readFileSync("utils/cloudNegocio.ts", "utf8");
const textos = fs.readFileSync("constants/i18n.ts", "utf8");
const fallos = [];

if (!storage.includes("export function subscribeStorageWriteErrors")) {
  fallos.push("El guardado local no permite informar sus fallos.");
}
if (!contexto.includes("subscribeStorageWriteErrors(() =>")) {
  fallos.push("La app no escucha los errores del almacenamiento.");
}
if ((textos.match(/"toast\.localSaveFailed"/g) ?? []).length !== 3) {
  fallos.push("El aviso de guardado debe existir en los tres idiomas.");
}
assert.match(cloud, /saveCloudData\([\s\S]*?if \(hasUnreadableLocalData\(\)\)/,
  "un historial local ilegible nunca se sube como copia vacía");
assert.match(businessCloud, /subirNegocio\([\s\S]*?if \(hasUnreadableLocalData\(\)\)/,
  "un negocio local ilegible tampoco pisa su copia en Firebase");

if (fallos.length) {
  fallos.forEach((fallo) => console.error("FALLA:", fallo));
  process.exit(1);
}

// Prueba el almacén REAL con SecureStore/AsyncStorage sustituidos por memoria.
// Antes de la protección ambas situaciones pasaban por vacío y sobrescribían
// el texto cifrado original, así que esta prueba falla contra esa versión.
const require = createRequire(import.meta.url);
const root = process.cwd();
const stub = (name) => path.join(root, "pruebas", "stubs", name);
async function runStorageScenario(source) {
  const result = esbuild.buildSync({
    stdin: { contents: 'import { setAccountStorageAvailable } from "@/utils/storage"; setAccountStorageAvailable(true);\n' + source, resolveDir: root, sourcefile: "storage-safety-scenario.ts", loader: "ts" },
    bundle: true,
    platform: "node",
    format: "cjs",
    write: false,
    logLevel: "silent",
    alias: {
      "@": root,
      "@react-native-async-storage/async-storage": stub("async-storage.ts"),
      "expo-secure-store": stub("secure-store.ts"),
      "expo-crypto": stub("crypto.ts"),
    },
  });
  const loaded = { exports: {} };
  new Function("module", "exports", "require", result.outputFiles[0].text)(loaded, loaded.exports, require);
  await loaded.exports.run();
}

await runStorageScenario(`
  import assert from "node:assert/strict";
  import AsyncStorage from "@react-native-async-storage/async-storage";
  import * as SecureStore from "expo-secure-store";
  import { saveJSON, loadJSON, flushPendingSavesChecked, subscribeStorageWriteErrors, STORAGE_KEYS } from "@/utils/storage";
  export async function run() {
    await SecureStore.setItemAsync("finzo_encryption_key_v1", "a".repeat(64));
    let notices = 0;
    const unsubscribe = subscribeStorageWriteErrors(() => { notices++; });
    const originalWrite = AsyncStorage.setItem;
    try {
      AsyncStorage.setItem = async () => { throw new Error("native-write-failed"); };
      saveJSON(STORAGE_KEYS.transactions, [{ id: 21 }]);
      assert.equal(await flushPendingSavesChecked(), false, "un fallo real no confirma el guardado agrupado");
      assert.equal(notices, 1, "la interfaz debe recibir el fallo real, independientemente de cómo esté escrito el catch");
      AsyncStorage.setItem = originalWrite;
      saveJSON(STORAGE_KEYS.transactions, [{ id: 21 }]);
      assert.equal(await flushPendingSavesChecked(), true, "el reintento sí se confirma tras escribir");
      assert.deepEqual(await loadJSON(STORAGE_KEYS.transactions, []), [{ id: 21 }]);
    } finally { AsyncStorage.setItem = originalWrite; unsubscribe(); }
  }
`);

await runStorageScenario(`
  import assert from "node:assert/strict";
  import AsyncStorage from "@react-native-async-storage/async-storage";
  import * as SecureStore from "expo-secure-store";
  import { encryptText } from "@/utils/encryption";
  export async function run() {
    await AsyncStorage.setItem("finzo:transactions", "v2:00000000000000000000000000000000:payload:mac");
    await assert.rejects(encryptText("nuevo"), /encryption-key-missing-with-existing-data/);
    assert.equal(await SecureStore.getItemAsync("finzo_encryption_key_v1"), null);
  }
`);

await runStorageScenario(`
  import assert from "node:assert/strict";
  import AsyncStorage from "@react-native-async-storage/async-storage";
  import * as SecureStore from "expo-secure-store";
  import { encryptText } from "@/utils/encryption";
  import { hasUnreadableLocalData, loadJSON, saveJSON, saveJSONNow, flushPendingSaves, STORAGE_KEYS } from "@/utils/storage";
  export async function run() {
    await SecureStore.setItemAsync("finzo_encryption_key_v1", "a".repeat(64));
    const valid = await encryptText(JSON.stringify([{ id: 7 }]));
    const damaged = valid.slice(0, -1) + (valid.endsWith("0") ? "1" : "0");
    await AsyncStorage.setItem(STORAGE_KEYS.transactions, damaged);
    assert.deepEqual(await loadJSON(STORAGE_KEYS.transactions, []), []);
    assert.equal(hasUnreadableLocalData(), true);
    assert.equal(await saveJSONNow(STORAGE_KEYS.transactions, []), false);
    saveJSON(STORAGE_KEYS.transactions, []);
    await flushPendingSaves();
    assert.equal(await AsyncStorage.getItem(STORAGE_KEYS.transactions), damaged);
  }
`);

console.log("Guardado local: un fallo real ya no se presenta como éxito.");
