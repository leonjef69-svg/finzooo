import assert from "node:assert/strict";
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { buildSync } from "esbuild";

const require = createRequire(import.meta.url);
const root = process.cwd();
const stub = name => path.join(root, "pruebas/stubs", name);
function loadEncryption() {
  const result = buildSync({
    stdin: { contents: `export * from './utils/encryption';
      export * as secure from 'expo-secure-store';
      export { default as storage } from '@react-native-async-storage/async-storage';`,
      resolveDir: root, loader: "ts" },
    bundle: true, platform: "node", format: "cjs", write: false, logLevel: "silent",
    alias: { "expo-secure-store": stub("secure-store.ts"), "expo-crypto": stub("crypto.ts"),
      "@react-native-async-storage/async-storage": stub("async-storage.ts") },
  });
  const module = { exports: {} };
  new Function("module", "exports", "require", result.outputFiles[0].text)(module, module.exports, require);
  return module.exports;
}
const keyName = "finzo_encryption_key_v1";
const key = randomBytes(32);
function oldCipher(text, authenticated = true) {
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]).toString("base64");
  const payload = `${iv.toString("hex")}:${encrypted}`;
  return authenticated ? `v2:${payload}:${createHmac("sha256", key).update(payload).digest("hex")}` : payload;
}
const api = loadEncryption();
await api.secure.setItemAsync(keyName, key.toString("hex"));
const big = JSON.stringify(Array.from({ length: 10000 }, (_, id) => ({
  id, description: `Almuerzo ñá 😀 ${id}`, amount: (id + 1) / 100, date: "2026-10-07",
})));
for (const text of ["a", "a".repeat(15), "a".repeat(16), "a".repeat(17), "\ufeffS/ 9.90 🥑 中文\n", big]) {
  assert.equal(await api.decryptText(oldCipher(text, false)), text, "Lectura del formato antiguo");
  assert.equal(await api.decryptText(oldCipher(text)), text, "Lectura del formato autenticado actual");
  const encrypted = await api.encryptText(text);
  const [version, iv, cipher, mac] = encrypted.split(":");
  assert.equal(version, "v2", "Mantener formato para no migrar ni romper versiones anteriores");
  assert.equal(mac, createHmac("sha256", key).update(`${iv}:${cipher}`).digest("hex"));
  const decipher = createDecipheriv("aes-256-cbc", key, Buffer.from(iv, "hex"));
  assert.equal(Buffer.concat([decipher.update(Buffer.from(cipher, "base64")), decipher.final()]).toString("utf8"), text);
  assert.equal(await api.decryptText(encrypted), text);
}
const valid = oldCipher("datos importantes");
assert.equal(await api.decryptText(valid + ":basura"), null, "No ignorar campos adicionales");
assert.equal(await api.decryptText(oldCipher("antiguo", false) + ":basura"), null);
assert.equal(await api.decryptText(valid.slice(0, -1)), null);
assert.equal(await api.decryptText(valid.replace("v2:", "v3:")), null);
const parts = valid.split(":");
for (const index of [1, 2, 3]) {
  const changed = [...parts];
  changed[index] = (changed[index][0] === "0" ? "1" : "0") + changed[index].slice(1);
  assert.equal(await api.decryptText(changed.join(":")), null, `Alteración del campo ${index}`);
}
assert.notEqual(await api.encryptText("mismo"), await api.encryptText("mismo"), "IV nuevo por guardado");

const invalidKey = loadEncryption();
await invalidKey.secure.setItemAsync(keyName, "no-es-una-llave");
await assert.rejects(invalidKey.encryptText("nuevo"), /encryption-key-invalid/);
assert.equal(await invalidKey.secure.getItemAsync(keyName), "no-es-una-llave", "No reemplazar la llave dañada");
const missingKey = loadEncryption();
await missingKey.storage.setItem("finzo:transactions", valid);
await assert.rejects(missingKey.encryptText("nuevo"), /encryption-key-missing-with-existing-data/);
assert.equal(await missingKey.storage.getItem("finzo:transactions"), valid);

// Ejecutar también el decodificador que Expo instala en Android, no solo el
// de Node: sus opciones de UTF-8/BOM deben conservar el mismo contenido.
const decoderBuild = buildSync({
  entryPoints: [path.join(path.dirname(require.resolve("expo/package.json")), "src/winter/TextDecoder.ts")],
  bundle: true, platform: "node", format: "cjs", write: false, logLevel: "silent",
});
const decoderModule = { exports: {} };
new Function("module", "exports", "require", decoderBuild.outputFiles[0].text)(decoderModule, decoderModule.exports, require);
const originalDecoder = globalThis.TextDecoder;
try {
  globalThis.TextDecoder = decoderModule.exports.TextDecoder;
  for (const text of ["\ufeffÁrbol 🌳 中文", big]) {
    assert.equal(await api.decryptText(oldCipher(text)), text);
    assert.equal(await api.decryptText(await api.encryptText(text)), text);
  }
} finally {
  globalThis.TextDecoder = originalDecoder;
}
console.log("Cifrado real: 10.000 movimientos compatibles con AES/HMAC independiente; formatos, claves e integridad comprobados.");
