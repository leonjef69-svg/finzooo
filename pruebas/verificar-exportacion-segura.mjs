import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import * as esbuild from "esbuild";

const root = process.cwd();
const stub = (name) => path.join(root, "pruebas", "stubs", name);
const source = `
  import assert from "node:assert/strict";
  import * as SecureStore from "expo-secure-store";
  import { queueExport, takeQueuedExport } from "@/utils/pendingExport";
  import { disableLock, enableLock, isLockEnabled, lockEnabledState } from "@/utils/appLock";

  export async function run() {
    const automatic = { auto: true, silent: true, runKey: "scheduled-1" };
    const manual = { auto: false, silent: false, runKey: "notice-1" };
    const automaticToken = queueExport(automatic);
    const manualToken = queueExport(manual);
    assert.notEqual(automaticToken, manualToken, "dos órdenes distintas no comparten token");
    assert.deepEqual(takeQueuedExport(automaticToken), automatic);
    assert.deepEqual(takeQueuedExport(manualToken), manual);
    assert.equal(takeQueuedExport("inventado-desde-un-enlace"), null);

    const duplicate = { auto: true, runKey: "scheduled-2" };
    assert.equal(queueExport(duplicate), queueExport(duplicate), "el doble toque idéntico se agrupa");

    await SecureStore.setItemAsync("finzo.lock.enabled", "1");
    assert.equal(await lockEnabledState(), "enabled");
    SecureStore.setReadFailure(true);
    assert.equal(await lockEnabledState(), "unavailable");
    assert.equal(await isLockEnabled(), true, "el error nunca equivale a candado apagado");
    assert.equal(await enableLock("1234"), false, "no se anuncia activación sin lectura confirmada");
    SecureStore.setReadFailure(false);

    SecureStore.setDeleteFailureKey("finzo.lock.enabled");
    assert.equal(await disableLock(), false, "no se borra el PIN si el interruptor sigue activo");
    assert.ok(await SecureStore.getItemAsync("finzo.lock.hash"));
    SecureStore.setDeleteFailureKey(null);
    assert.equal(await disableLock(), true);
    assert.equal(await SecureStore.getItemAsync("finzo.lock.enabled"), null);

    SecureStore.setWriteFailureKey("finzo.lock.hash");
    assert.equal(await enableLock("5678"), false, "un PIN no guardado nunca activa el candado");
    assert.equal(await SecureStore.getItemAsync("finzo.lock.enabled"), null);
    SecureStore.setWriteFailureKey(null);
  }
`;
const result = esbuild.buildSync({
  stdin: { contents: source, resolveDir: root, sourcefile: "safe-export-test.ts", loader: "ts" },
  bundle: true,
  platform: "node",
  format: "cjs",
  write: false,
  logLevel: "silent",
  alias: {
    "@": root,
    "expo-crypto": stub("crypto.ts"),
    "expo-secure-store": stub("secure-store.ts"),
    "expo-local-authentication": stub("local-auth.ts"),
  },
});
const require = createRequire(import.meta.url);
const loaded = { exports: {} };
new Function("module", "exports", "require", result.outputFiles[0].text)(loaded, loaded.exports, require);
await loaded.exports.run();

const route = fs.readFileSync("app/export-pdf.tsx", "utf8");
const lockGate = fs.readFileSync("components/AppLockGate.tsx", "utf8");
assert.match(route, /takeQueuedExport\(token\)/);
assert.doesNotMatch(route, /params\.auto|params\.silent|params\.dest|params\.run/);
assert.match(route, /if \(blocked \|\| locked\) return null/);
assert.match(lockGate, /status === "unavailable"[\s\S]*?setLocked\(true\)/);
assert.match(lockGate, /const reciente = !hadReadError && await salioHaceNada\(\)/);
assert.match(lockGate, /<Modal visible/);

console.log("Exportación interna separada; enlace externo inocuo; candado cerrado ante fallos de lectura.");
