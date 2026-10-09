import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { createSourceReader } from "./helpers/source-reader.mjs";

// Bóveda, almacén y AES/HMAC originales. Solo Auth y IO Android son ficticios;
// ningún archivo, cuenta, integración, dato financiero o nube real se usa.
// La regresión sustituye SOLO la fuente original de la bóveda por Git.
const root = process.cwd(), require = createRequire(import.meta.url);
const read = createSourceReader({ revision: process.env.FINO_LEGACY_OWNER_BASELINE ?? "" });
const ownerKey = "finzo:localAccountOwner:v1";
const verified = () => ({ uid: "legacy-uid", email: "legacy@example.test", emailVerified: true });

async function environment() {
  const result = await build({ stdin: { contents: `
    export { auth } from '@/utils/firebase';
    export { default as disk, failNextStorageOperation } from '@react-native-async-storage/async-storage';
    export { encryptText, decryptText } from '@/utils/encryption';
    export { pauseNextCrypto } from 'expo-crypto';
    export { getAccountStorageSession, setAccountStorageAvailable, loadJSON, saveJSON, saveJSONNow, flushPendingSaves, clearAccountData, STORAGE_KEYS } from '@/utils/storage';
    export { prepareLocalAccount, archiveLocalAccount, LocalAccountVaultError } from '@/utils/localAccountVault';
  `, resolveDir: root, sourcefile: "legacy-owner-original.ts", loader: "ts" },
    bundle: true, platform: "node", format: "cjs", write: false, logLevel: "silent",
    alias: { "@": root, "@/utils/firebase": path.join(root, "pruebas/stubs/firebase-local.ts"),
      "@react-native-async-storage/async-storage": path.join(root, "pruebas/stubs/async-storage.ts"),
      "expo-secure-store": path.join(root, "pruebas/stubs/secure-store.ts") },
    plugins: [{ name: "original-and-memory-io", setup(bundle) {
      bundle.onLoad({ filter: /[\\/]utils[\\/]localAccountVault\.ts$/ }, () => ({ contents: read("utils/localAccountVault.ts"), loader: "ts", resolveDir: path.join(root, "utils") }));
      bundle.onResolve({ filter: /^expo-crypto$/ }, () => ({ path: "crypto", namespace: "memory-io" }));
      bundle.onLoad({ filter: /.*/, namespace: "memory-io" }, () => ({ contents: `
        import { randomBytes, randomUUID as uuid, createHash } from 'node:crypto';
        let waiting = null;
        export function pauseNextCrypto() {
          let started, resume;
          const reached = new Promise(done => { started = done; });
          const released = new Promise(done => { resume = done; });
          waiting = { started, released };
          return { reached, resume };
        }
        export async function getRandomBytesAsync(length) {
          const paused = waiting; waiting = null;
          if (paused) { paused.started(); await paused.released; }
          return randomBytes(length);
        }
        export function randomUUID() { return uuid(); }
        export const CryptoDigestAlgorithm = { SHA256: 'SHA256' };
        export async function digestStringAsync(_algorithm, text) { return createHash('sha256').update(text).digest('hex'); }
      `, loader: "js" }));
    } }] });
  const module = { exports: {} };
  new Function("module", "exports", "require", result.outputFiles[0].text)(module, module.exports, require);
  return module.exports;
}

async function legacy(api) {
  api.setAccountStorageAvailable(true);
  await api.saveJSONNow(api.STORAGE_KEYS.profile, { hasOnboarded: true, userEmail: "legacy@example.test", userName: "Perfil antiguo" });
  await api.saveJSONNow(api.STORAGE_KEYS.transactions, [{ id: 51, amount: 50, description: "Original privado ficticio" }]);
  await api.saveJSONNow(api.STORAGE_KEYS.categoryCustom, { photo: "foto-privada-ficticia" });
  return new Map(await api.disk.multiGet([api.STORAGE_KEYS.profile, api.STORAGE_KEYS.transactions, api.STORAGE_KEYS.categoryCustom]));
}
async function preserved(api, original, { noOwner = true } = {}) {
  assert.deepEqual(new Map(await api.disk.multiGet([...original.keys()])), original, "rechazar no reescribe ni elimina los originales cifrados");
  if (noOwner) assert.equal(await api.disk.getItem(ownerKey), null, "correo/sesión sin confirmar no quedan como dueño");
  assert.equal(api.getAccountStorageSession(), null, "rechazo mantiene bloqueadas las lecturas de cuenta");
  assert.deepEqual(await api.loadJSON(api.STORAGE_KEYS.transactions, []), [], "no expone el movimiento antiguo");
}
const rejectReason = reason => error => error?.name === "LocalAccountVaultError" && error.reason === reason;

// Primero el caso que debe ser ROJO en 19e5dde: email coincidente no es prueba.
{
  const api = await environment(), original = await legacy(api);
  api.auth.currentUser = { ...verified(), emailVerified: false };
  await assert.rejects(api.prepareLocalAccount("legacy-uid", "legacy@example.test"), rejectReason("verification"), "un correo no confirmado no puede adoptar historial legacy");
  await preserved(api, original);
  api.auth.currentUser.emailVerified = true;
  assert.equal(await api.prepareLocalAccount("legacy-uid", "legacy@example.test"), true, "confirmar la misma cuenta desbloquea sus originales");
  assert.equal((await api.loadJSON(api.STORAGE_KEYS.transactions, []))[0].amount, 50);
}
for (const session of [null, { ...verified(), uid: "otro-uid" }, { ...verified(), email: "otro@example.test" }]) {
  const api = await environment(), original = await legacy(api);
  api.auth.currentUser = session;
  await assert.rejects(api.prepareLocalAccount("legacy-uid", "legacy@example.test"), rejectReason("owner"));
  await preserved(api, original);
}
{
  const api = await environment(), original = await legacy(api);
  api.auth.currentUser = verified();
  await assert.rejects(api.prepareLocalAccount("legacy-uid", "otro@example.test"), rejectReason("owner"));
  await preserved(api, original);
}

// Una sesión cambia mientras el cifrado nativo del dueño está pendiente.
{
  const api = await environment(), original = await legacy(api);
  api.auth.currentUser = verified();
  const get = api.disk.getItem;
  api.disk.getItem = async key => {
    const raw = await get(key);
    if (key === api.STORAGE_KEYS.profile) api.auth.currentUser = verified();
    return raw;
  };
  await assert.rejects(api.prepareLocalAccount("legacy-uid", "legacy@example.test"), rejectReason("owner"), "ni el mismo UID reemplazado durante la lectura conserva la solicitud anterior");
  await preserved(api, original);
}
for (const replacement of [null, { ...verified(), uid: "otra-cuenta" }, verified()]) {
  const api = await environment(), original = await legacy(api);
  api.auth.currentUser = verified();
  const pause = api.pauseNextCrypto();
  const opening = api.prepareLocalAccount("legacy-uid", "legacy@example.test");
  const rejected = assert.rejects(opening, rejectReason("owner"));
  await pause.reached; api.auth.currentUser = replacement; pause.resume();
  await rejected; await preserved(api, original);
}
{
  const api = await environment(), original = await legacy(api);
  api.auth.currentUser = verified();
  const pause = api.pauseNextCrypto();
  const opening = api.prepareLocalAccount("legacy-uid", "legacy@example.test");
  const rejected = assert.rejects(opening, rejectReason("verification"));
  await pause.reached; api.auth.currentUser.emailVerified = false; pause.resume();
  await rejected; await preserved(api, original);
}

// Cambia Auth cuando AsyncStorage termina la escritura/lectura de confirmación.
for (const phase of ["write", "confirm"]) {
  const api = await environment(), original = await legacy(api);
  api.auth.currentUser = verified();
  const set = api.disk.setItem, get = api.disk.getItem;
  let ownerReads = 0;
  api.disk.setItem = async (key, value) => {
    await set(key, value);
    if (phase === "write" && key === ownerKey) api.auth.currentUser = null;
  };
  api.disk.getItem = async key => {
    const raw = await get(key);
    if (key === ownerKey && ++ownerReads === 2 && phase === "confirm") api.auth.currentUser = { ...verified(), uid: "otra-cuenta" };
    return raw;
  };
  await assert.rejects(api.prepareLocalAccount("legacy-uid", "legacy@example.test"), rejectReason("owner"));
  await preserved(api, original);
}

// La conservación activa gana a una snapshot aislada: no se borra al reclamar.
{
  const api = await environment(); api.auth.currentUser = verified();
  await legacy(api); await api.prepareLocalAccount("legacy-uid", "legacy@example.test");
  await api.archiveLocalAccount("legacy-uid", "legacy@example.test");
  await api.disk.removeItem(ownerKey); api.setAccountStorageAvailable(true);
  await api.saveJSONNow(api.STORAGE_KEYS.transactions, [{ id: 99, amount: 99 }]);
  assert.equal(await api.prepareLocalAccount("legacy-uid", " LEGACY@EXAMPLE.TEST "), true);
  assert.equal((await api.loadJSON(api.STORAGE_KEYS.transactions, []))[0].amount, 99, "no restaura una snapshot antigua sobre el perfil activo legacy");
}

// Una cuenta nueva no verificada conserva la configuración previa sin historial.
{
  const api = await environment(); api.setAccountStorageAvailable(true);
  await api.saveJSONNow(api.STORAGE_KEYS.profile, { hasOnboarded: false, userCurrency: "PEN", userLanguage: "es" });
  api.saveJSON(api.STORAGE_KEYS.profile, { hasOnboarded: false, userCurrency: "USD", userLanguage: "en" });
  api.auth.currentUser = { uid: "nueva", email: "new@example.test", emailVerified: false };
  assert.equal(await api.prepareLocalAccount("nueva", "new@example.test"), false);
  await api.flushPendingSaves();
  assert.equal((await api.loadJSON(api.STORAGE_KEYS.profile, null)).userCurrency, "USD", "no descarta la última preferencia pendiente de una cuenta nueva");
  assert.equal(JSON.parse(await api.decryptText(await api.disk.getItem(ownerKey))).uid, "nueva");
}

// El dueño moderno por UID no necesita repetir el email legacy. A→B→A intacto.
{
  const api = await environment(); api.auth.currentUser = verified();
  await legacy(api); await api.prepareLocalAccount("legacy-uid", "legacy@example.test");
  api.auth.currentUser.emailVerified = false;
  assert.equal(await api.prepareLocalAccount("legacy-uid", "legacy@example.test"), true);
  await api.archiveLocalAccount("legacy-uid", "legacy@example.test"); await api.clearAccountData();
  api.auth.currentUser = { uid: "B", email: "b@example.test", emailVerified: false };
  assert.equal(await api.prepareLocalAccount("B", "b@example.test"), false);
  await api.archiveLocalAccount("B", "b@example.test"); await api.clearAccountData();
  api.auth.currentUser = { ...verified(), emailVerified: false };
  assert.equal(await api.prepareLocalAccount("legacy-uid", "legacy@example.test"), true);
  assert.equal((await api.loadJSON(api.STORAGE_KEYS.transactions, []))[0].amount, 50);
}
console.log("Bóveda/almacén/cifrado originales: legacy exige UID, correo confirmado y misma sesión; rechazo conserva bytes y bloquea lectura; interrupciones no adjudican; cuentas nuevas/modernas A→B→A intactas. Android y correo real pendientes.");
